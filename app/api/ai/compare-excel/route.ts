import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import openai from "@/lib/openai";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ROWS = 150; // token limitini aşmamak için

const PROMPT = `İki Excel dosyasını karşılaştır.
Farklı olan hücreleri, eksik satırları, yeni eklenen satırları tespit et.
Özet rapor ve detaylı fark listesi oluştur.
JSON formatında döndür:
{
  "ozet": {
    "dosya1_satir_sayisi": number,
    "dosya2_satir_sayisi": number,
    "degisen_satir": number,
    "eklenen_satir": number,
    "silinen_satir": number
  },
  "farklar": [
    {
      "satir": number,
      "alan": "sütun adı",
      "eski_deger": "değer",
      "yeni_deger": "değer",
      "tip": "degistirildi" | "eklendi" | "silindi"
    }
  ]
}
Sadece JSON objesi döndür.`;

async function excelToText(buffer: Buffer, label: string): Promise<{ text: string; rowCount: number }> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
  const rowCount = rows.length;
  const limited = rows.slice(0, MAX_ROWS);
  const text = `${label}:\n` + limited.map((r) => r.join("\t")).join("\n");
  return { text, rowCount };
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const { role, department } = token as any;
  if (role !== "ADMIN" && department !== "MUHASEBE") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek formatı" }, { status: 400 });
  }

  const file1 = formData.get("file1") as File | null;
  const file2 = formData.get("file2") as File | null;

  if (!file1 || !file2) {
    return NextResponse.json({ error: "İki Excel dosyası da gereklidir" }, { status: 400 });
  }
  if (file1.size > MAX_SIZE || file2.size > MAX_SIZE) {
    return NextResponse.json({ error: "Dosya boyutu 10MB'ı geçemez" }, { status: 400 });
  }

  const allowedTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/octet-stream",
  ];
  const isExcel = (f: File) =>
    allowedTypes.includes(f.type) || f.name.endsWith(".xlsx") || f.name.endsWith(".xls");

  if (!isExcel(file1) || !isExcel(file2)) {
    return NextResponse.json({ error: "Yalnızca Excel (.xlsx / .xls) dosyaları desteklenmektedir" }, { status: 400 });
  }

  try {
    const [buf1, buf2] = await Promise.all([
      file1.arrayBuffer().then(Buffer.from),
      file2.arrayBuffer().then(Buffer.from),
    ]);

    const [{ text: text1, rowCount: rc1 }, { text: text2, rowCount: rc2 }] = await Promise.all([
      excelToText(buf1, `Dosya 1 (${file1.name})`),
      excelToText(buf2, `Dosya 2 (${file2.name})`),
    ]);

    const truncationNote =
      rc1 > MAX_ROWS || rc2 > MAX_ROWS
        ? `\n\nNot: Dosyalar çok büyük olduğu için yalnızca ilk ${MAX_ROWS} satır analiz edildi.`
        : "";

    const response = await openai.chat.completions.create({
      model: "gpt-5.4-nano",
      messages: [
        {
          role: "user",
          content: `${PROMPT}${truncationNote}\n\n${text1}\n\n${text2}`,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4000,
    });

    const raw = response.choices[0].message.content ?? "{}";
    const result = JSON.parse(raw);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[compare-excel]", err);
    if (err?.code === "invalid_api_key") {
      return NextResponse.json({ error: "OpenAI API anahtarı geçersiz" }, { status: 500 });
    }
    return NextResponse.json({ error: "Karşılaştırma sırasında bir hata oluştu. Lütfen tekrar deneyin" }, { status: 500 });
  }
}
