import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getOpenAI } from "@/lib/openai";
import { getAiPrompt } from "@/lib/ai-prompts";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

async function extractText(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "pdf") {
    const { extractText: unpdfExtract } = await import("unpdf");
    const arrayBuffer = await file.arrayBuffer();
    const { text } = await unpdfExtract(new Uint8Array(arrayBuffer));
    return text;
  }

  if (ext === "xlsx" || ext === "xls") {
    const XLSX = await import("xlsx");
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      lines.push(`[Sayfa: ${sheetName}]\n${csv}`);
    }
    return lines.join("\n\n");
  }

  // TXT, DOCX, or any other: read as plain text
  return await file.text();
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Dosya yüklenmedi" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Dosya boyutu 10 MB'ı geçemez" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const ALLOWED = ["pdf", "docx", "xlsx", "xls", "txt"];
  if (!ALLOWED.includes(ext)) {
    return NextResponse.json({ error: "Desteklenmeyen dosya formatı" }, { status: 400 });
  }

  let documentText: string;
  try {
    documentText = await extractText(file);
  } catch (e: any) {
    return NextResponse.json({ error: "Dosya okunamadı: " + (e?.message ?? "bilinmeyen hata") }, { status: 422 });
  }

  if (!documentText.trim()) {
    return NextResponse.json({ error: "Belgeden metin çıkarılamadı" }, { status: 422 });
  }

  // Truncate to avoid token overflow (~80k chars ≈ ~20k tokens)
  const truncated = documentText.length > 80000 ? documentText.slice(0, 80000) + "\n\n[... belge kısaltıldı ...]" : documentText;

  const systemPrompt = await getAiPrompt("BELGE_OZETI");

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-5.4-nano",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Belge adı: ${file.name}\n\nBelge içeriği:\n${truncated}` },
    ],
    temperature: 0,
    max_completion_tokens: 1000,
  });

  const result = completion.choices[0]?.message?.content?.trim() ?? "";
  return NextResponse.json({ result });
}
