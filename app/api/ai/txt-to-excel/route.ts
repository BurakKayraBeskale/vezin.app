import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getOpenAI } from "@/lib/openai";
import { getAiPrompt } from "@/lib/ai-prompts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const BACKEND_CHUNK_LINES = 50;    // her OpenAI çağrısına gönderilen max satır sayısı

function buildContinuationPrompt(headers: string[]): string {
  return `Sen bir Türk muhasebe uzmanısın.
Aşağıdaki metin daha önce işlemeye başladığın mizanın devamıdır.
Sütun başlıkları zaten belirlendi: ${JSON.stringify(headers)}

Bu metin parçasındaki satırları aynı sütun sırasına göre dönüştür.
Türkçe karakterleri koru. Sayısal değerleri tam al.
JSON formatında döndür: {"rows": [...]}
Sadece JSON döndür, başka açıklama yazma.
Yanıtını JSON formatında ver.`;
}

/** Tek bir OpenAI çağrısı — ham yanıtı ve parse edilmiş sonucu birlikte döndürür */
async function callOpenAI(
  openai: ReturnType<typeof getOpenAI>,
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<{ parsed: any; raw: string; finishReason: string }> {
  let response: any;
  try {
    response = await openai.chat.completions.create({
      model: "gpt-5.4-nano",
      messages: [
        {
          role: "system",
          content: [
            {
              type: "text",
              text: systemPrompt,
              cache_control: { type: "ephemeral" },
            },
          ] as any,
        },
        ...messages,
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 8000,
    });
    console.log("[txt-to-excel] Tam yanıt:", JSON.stringify(response));
    console.log("[txt-to-excel] Content:", response.choices?.[0]?.message?.content);
  } catch (err: any) {
    console.error(
      "[txt-to-excel] OpenAI hata detayı:",
      err?.status, err?.code, err?.message,
      JSON.stringify(err?.error ?? err)
    );
    throw err;
  }

  const raw = response.choices[0]?.message?.content ?? "";
  const finishReason = response.choices[0]?.finish_reason ?? "unknown";

  console.log("[txt-to-excel] --- OpenAI RAW RESPONSE ---");
  console.log("[txt-to-excel] finish_reason:", finishReason);
  console.log("[txt-to-excel] raw length:", raw.length);
  console.log("[txt-to-excel] raw:", raw);
  console.log("[txt-to-excel] --- END RAW RESPONSE ---");

  if (!raw.trim()) {
    throw new Error("OpenAI boş yanıt döndürdü. Model token limitini aşmış olabilir.");
  }

  try {
    return { parsed: JSON.parse(raw), raw, finishReason };
  } catch {
    console.warn("[txt-to-excel] JSON parse başarısız, retry yapılıyor...");
    const retryResponse = await openai.chat.completions.create({
      model: "gpt-5.4-nano",
      messages: [
        {
          role: "system",
          content: [
            {
              type: "text",
              text: systemPrompt,
              cache_control: { type: "ephemeral" },
            },
          ] as any,
        },
        ...messages,
        { role: "assistant", content: raw },
        {
          role: "user",
          content:
            "Verdiğin yanıt geçerli JSON değil. Sadece geçerli bir JSON objesi döndür, hiçbir açıklama veya markdown ekleme.",
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 8000,
    });
    const retryRaw = retryResponse.choices[0]?.message?.content ?? "{}";
    console.log("[txt-to-excel] retry raw:", retryRaw);
    try {
      return { parsed: JSON.parse(retryRaw), raw: retryRaw, finishReason };
    } catch {
      throw new Error(`JSON ayrıştırılamadı. Ham yanıt: ${retryRaw.slice(0, 300)}`);
    }
  }
}

/**
 * Metni BACKEND_CHUNK_LINES satırlık parçalara böler,
 * her parçayı ayrı OpenAI çağrısıyla işler, sonuçları birleştirir.
 * knownHeaders verilmezse ilk parçadan headers çıkarır.
 */
async function processInChunks(
  openai: ReturnType<typeof getOpenAI>,
  text: string,
  systemPrompt: string,
  knownHeaders?: string[]
): Promise<{ headers?: string[]; rows: any[][]; firstRaw?: string }> {
  const lines = text.split("\n");
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);

  const chunks: string[] = [];
  for (let i = 0; i < nonEmptyLines.length; i += BACKEND_CHUNK_LINES) {
    const slice = nonEmptyLines.slice(i, i + BACKEND_CHUNK_LINES).join("\n");
    if (slice.trim()) chunks.push(slice);
  }

  if (chunks.length === 0) {
    throw new Error("İşlenecek satır bulunamadı.");
  }

  console.log(`[txt-to-excel] ${nonEmptyLines.length} satır → ${chunks.length} parça`);

  let headers: string[] = knownHeaders ?? [];
  let allRows: any[][] = [];
  let firstRaw: string | undefined;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`[txt-to-excel] Parça ${i + 1}/${chunks.length} işleniyor (${chunk.split("\n").length} satır)...`);

    try {
      if (i === 0 && !knownHeaders) {
        // İlk parça: headers + rows
        const { parsed, raw } = await callOpenAI(openai, systemPrompt, [
          { role: "user", content: `Metin içeriği:\n${chunk}` },
        ]);
        firstRaw = raw; // ilk ham yanıtı sakla
        if (!Array.isArray(parsed.headers) || !Array.isArray(parsed.rows)) {
          console.error("[txt-to-excel] Beklenmedik format:", JSON.stringify(parsed).slice(0, 300));
          throw new Error("Model beklenen formatta yanıt döndürmedi.");
        }
        headers = parsed.headers;
        // Satırları normalize et: model obje döndürdüyse headers sırasına göre diziye çevir
        const normalizeRow = (row: any): any[] => {
          if (Array.isArray(row)) return row;
          if (row && typeof row === "object") return headers.map((h) => row[h] ?? "");
          return [];
        };
        allRows = [...allRows, ...parsed.rows.map(normalizeRow)];
      } else {
        // Devam parçaları: sadece rows
        const { parsed } = await callOpenAI(openai, buildContinuationPrompt(headers), [
          { role: "user", content: `Metin devamı:\n${chunk}` },
        ]);
        if (Array.isArray(parsed.rows)) {
          const normalizeRow = (row: any): any[] => {
            if (Array.isArray(row)) return row;
            if (row && typeof row === "object") return headers.map((h) => row[h] ?? "");
            return [];
          };
          allRows = [...allRows, ...parsed.rows.map(normalizeRow)];
        } else {
          console.warn(`[txt-to-excel] Parça ${i + 1} rows döndürmedi, atlandı.`);
        }
      }
    } catch (err: any) {
      console.error(`[txt-to-excel] Parça ${i + 1} hatası:`, err.message);
    }
  }

  return knownHeaders ? { rows: allRows } : { headers, rows: allRows, firstRaw };
}

export async function POST(req: NextRequest) {
  console.log("[txt-to-excel] İstek geldi, content-type:", req.headers.get("content-type"));

  let openai: ReturnType<typeof getOpenAI>;
  try {
    openai = getOpenAI();
  } catch (err: any) {
    console.error("[txt-to-excel] OpenAI init hatası:", err);
    return NextResponse.json({ error: "OpenAI başlatılamadı: " + err.message }, { status: 500 });
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  let text = "";
  let knownHeaders: string[] | null = null;

  const contentType = req.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();

      const file = formData.get("file") as File | null;
      const rawText = formData.get("text") as string | null;
      const headersParam = formData.get("headers") as string | null;

      if (headersParam) {
        try {
          knownHeaders = JSON.parse(headersParam);
        } catch {
          return NextResponse.json({ error: "Geçersiz headers parametresi" }, { status: 400 });
        }
      }

      if (file) {
        if (file.size > MAX_SIZE) {
          return NextResponse.json({ error: "Dosya boyutu 10MB'ı geçemez" }, { status: 400 });
        }
        text = await file.text();
      } else if (rawText) {
        text = rawText;
      } else {
        return NextResponse.json({ error: "Dosya veya metin bulunamadı" }, { status: 400 });
      }
    } else {
      const body = await req.json().catch(() => ({}));
      text = body.text ?? "";
      if (body.headers) knownHeaders = body.headers;
    }
  } catch (err: any) {
    console.error("[txt-to-excel] İstek ayrıştırma hatası:", err);
    return NextResponse.json({ error: "İstek okunamadı: " + err.message }, { status: 400 });
  }

  console.log("[txt-to-excel] text uzunluğu:", text.length, "| knownHeaders:", JSON.stringify(knownHeaders)?.slice(0, 100));

  if (!text.trim()) {
    return NextResponse.json({ error: "Metin içeriği boş" }, { status: 400 });
  }

  try {
    if (knownHeaders) {
      // Devam isteği — continuation modunda chunk'la
      const contPrompt = buildContinuationPrompt(knownHeaders) + "\n\nYanıtını JSON formatında ver.";
      const result = await processInChunks(openai, text, contPrompt, knownHeaders);
      return NextResponse.json({ rows: result.rows });
    } else {
      // İlk istek — headers çıkar + rows
      const basePrompt = await getAiPrompt("TXT_EXCEL");
      const result = await processInChunks(openai, text, basePrompt);

      if (!result.headers?.length) {
        console.log("[txt-to-excel] RETURN NOKTASI 1 — headers boş, 422 dönülüyor");
        console.log("[txt-to-excel] result.headers:", result.headers);
        console.log("[txt-to-excel] result.rows uzunluğu:", result.rows?.length);
        console.log("[txt-to-excel] firstRaw:", result.firstRaw);
        return NextResponse.json(
          {
            error: "Metin tablo formatına dönüştürülemedi. Daha yapılandırılmış bir metin deneyin.",
            raw: result.firstRaw ?? "(boş)",
          },
          { status: 422 }
        );
      }

      return NextResponse.json({ headers: result.headers, rows: result.rows });
    }
  } catch (err: any) {
    console.error(
      "[txt-to-excel] İşlem hatası:",
      err?.status, err?.code, err?.message,
      JSON.stringify(err?.error ?? err)
    );

    console.log("[txt-to-excel] RETURN NOKTASI 2 — catch bloğu, hata fırlatıldı");
    return NextResponse.json(
      {
        error: "Metin tablo formatına dönüştürülemedi.",
        raw: "",
        debug: {
          status: err?.status ?? null,
          code: err?.code ?? null,
          message: err?.message ?? "Bilinmeyen hata",
          detail: err?.error ?? null,
        },
      },
      { status: err?.status ?? 500 }
    );
  }
}
