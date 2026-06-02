import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SYSTEM_PROMPT = `Sen Vezin şirketinin muhasebe ve vergi asistanısın.
Kullanıcılara KDV, muhtasar, gelir vergisi, kurumlar vergisi, SGK, damga vergisi,
muhasebe kayıtları, mizan, bilanço ve diğer mali konularda yardım et.
Her zaman Türkçe cevap ver. Sayısal hesaplamaları dikkatli yap.
Yasal mevzuata göre bilgi ver. Gerektiğinde uyarı ekle.
Kod örnekleri vereceksen \`\`\` blokları kullan.`;

async function extractFileContent(file: File): Promise<{ text: string; isImage: boolean; base64?: string; mimeType?: string }> {
  if (file.type.startsWith("image/")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    return {
      text: "",
      isImage: true,
      base64: buffer.toString("base64"),
      mimeType: file.type,
    };
  }

  if (file.type === "application/pdf") {
    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    return { text: `[PDF: ${file.name}]\n${data.text.slice(0, 6000)}`, isImage: false };
  }

  if (
    file.type.includes("spreadsheet") ||
    file.type.includes("excel") ||
    file.name.endsWith(".xlsx") ||
    file.name.endsWith(".xls")
  ) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return { text: `[Excel: ${file.name}]\n${csv.slice(0, 6000)}`, isImage: false };
  }

  const text = await file.text();
  return { text: `[${file.name}]\n${text.slice(0, 6000)}`, isImage: false };
}

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || (token as any).role !== "ADMIN") {
    return new Response(JSON.stringify({ error: "Yetkisiz erişim" }), { status: 401 });
  }

  let messagesRaw: any[] = [];
  let model = "gpt-5.4-nano";
  let file: File | null = null;

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const fd = await req.formData();
    const msgsStr = fd.get("messages") as string | null;
    messagesRaw = msgsStr ? JSON.parse(msgsStr) : [];
    model = (fd.get("model") as string) || "gpt-5.4-nano";
    file = fd.get("file") as File | null;
  } else {
    const body = await req.json().catch(() => ({}));
    messagesRaw = body.messages ?? [];
    model = body.model || "gpt-5.4-nano";
  }

  if (!messagesRaw.length) {
    return new Response(JSON.stringify({ error: "Mesaj listesi boş" }), { status: 400 });
  }

  const messages = [...messagesRaw];
  if (file) {
    try {
      const extracted = await extractFileContent(file);
      const lastMsg = messages[messages.length - 1];

      if (extracted.isImage && extracted.base64) {
        if (lastMsg?.role === "user") {
          const existingText = typeof lastMsg.content === "string" ? lastMsg.content : "";
          messages[messages.length - 1] = {
            role: "user",
            content: [
              { type: "text", text: existingText || `Bu görseli analiz et: ${file.name}` },
              {
                type: "image_url",
                image_url: { url: `data:${extracted.mimeType};base64,${extracted.base64}`, detail: "high" },
              },
            ],
          };
        }
      } else if (extracted.text) {
        if (lastMsg?.role === "user") {
          const existingText = typeof lastMsg.content === "string" ? lastMsg.content : "";
          messages[messages.length - 1] = {
            role: "user",
            content: `${existingText}\n\n${extracted.text}`,
          };
        }
      }
    } catch (err) {
      console.error("[ai-chat] file extract error:", err);
    }
  }

  const fullMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages,
  ];

  try {
    const stream = await openai.chat.completions.create({
      model,
      messages: fullMessages as any,
      stream: true,
      max_completion_tokens: 4000,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? "";
            if (text) controller.enqueue(encoder.encode(text));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Accel-Buffering": "no",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: any) {
    console.error("[ai-chat]", err);
    return new Response(JSON.stringify({ error: err?.message ?? "GPT isteği başarısız" }), {
      status: 500,
    });
  }
}
