import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getOpenAI } from "@/lib/openai";
import { getAiPrompt } from "@/lib/ai-prompts";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VISION_PAGES = 6; // limit pages sent to vision to control cost/tokens

async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string | null> {
  const { extractText: unpdfExtract } = await import("unpdf");
  const { text } = await unpdfExtract(new Uint8Array(arrayBuffer));
  const extracted = Array.isArray(text) ? text.join("\n") : text;
  return extracted && extracted.trim().length >= 50 ? extracted : null;
}

async function pdfToBase64Images(arrayBuffer: ArrayBuffer): Promise<string[]> {
  const { pdf } = await import("pdf-to-img");
  const images: string[] = [];
  const document = await pdf(Buffer.from(arrayBuffer), { scale: 2 });
  let page = 0;
  for await (const img of document) {
    if (page >= MAX_VISION_PAGES) break;
    // img is a Buffer containing PNG bytes
    images.push((img as Buffer).toString("base64"));
    page++;
  }
  return images;
}

async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

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

  const systemPrompt = await getAiPrompt("BELGE_OZETI");
  const openai = getOpenAI();

  // PDF: try text extraction first, fall back to vision
  if (ext === "pdf") {
    const arrayBuffer = await file.arrayBuffer();
    const extractedText = await extractTextFromPdf(arrayBuffer).catch(() => null);

    if (extractedText) {
      // Text-based path
      const truncated =
        extractedText.length > 80000
          ? extractedText.slice(0, 80000) + "\n\n[... belge kısaltıldı ...]"
          : extractedText;

      const completion = await openai.chat.completions.create({
        model: "gpt-5.4-nano",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Belge adı: ${file.name}\n\nBelge içeriği:\n${truncated}` },
        ],
        temperature: 0,
        max_completion_tokens: 1000,
      });

      return NextResponse.json({
        result: completion.choices[0]?.message?.content?.trim() ?? "",
      });
    }

    // Fallback: convert pages to PNG and send via vision
    let pageImages: string[];
    try {
      pageImages = await pdfToBase64Images(arrayBuffer);
    } catch (e: any) {
      return NextResponse.json(
        { error: "PDF sayfaları görüntüye dönüştürülemedi: " + (e?.message ?? "bilinmeyen hata") },
        { status: 422 }
      );
    }

    if (pageImages.length === 0) {
      return NextResponse.json(
        { error: "PDF'den sayfa okunamadı. Dosya bozuk olabilir." },
        { status: 422 }
      );
    }

    const imageContent = pageImages.map((b64) => ({
      type: "image_url" as const,
      image_url: { url: `data:image/png;base64,${b64}`, detail: "high" as const },
    }));

    const completion = await openai.chat.completions.create({
      model: "gpt-5.4-nano",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            ...imageContent,
            {
              type: "text" as const,
              text: `Belge adı: ${file.name}${pageImages.length === MAX_VISION_PAGES ? ` (ilk ${MAX_VISION_PAGES} sayfa gösterildi)` : ""}`,
            },
          ],
        },
      ],
      temperature: 0,
      max_completion_tokens: 1000,
    });

    return NextResponse.json({
      result: completion.choices[0]?.message?.content?.trim() ?? "",
    });
  }

  // Non-PDF files
  let documentText: string;
  try {
    documentText = await extractTextFromFile(file);
  } catch (e: any) {
    return NextResponse.json(
      { error: "Dosya okunamadı: " + (e?.message ?? "bilinmeyen hata") },
      { status: 422 }
    );
  }

  if (!documentText.trim()) {
    return NextResponse.json({ error: "Belgeden metin çıkarılamadı" }, { status: 422 });
  }

  const truncated =
    documentText.length > 80000
      ? documentText.slice(0, 80000) + "\n\n[... belge kısaltıldı ...]"
      : documentText;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4-nano",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Belge adı: ${file.name}\n\nBelge içeriği:\n${truncated}` },
    ],
    temperature: 0,
    max_completion_tokens: 1000,
  });

  return NextResponse.json({
    result: completion.choices[0]?.message?.content?.trim() ?? "",
  });
}
