/**
 * Ortak PDF → Vision → GPT yardımcı fonksiyonları.
 * Hem beyanname/route.ts hem de capraz-kontrol/route.ts bu modülü kullanır.
 */

export const MAX_VISION_PAGES = 6;
export const PAGED_THRESHOLD  = 2;

/** PDF buffer'ı base64 sayfa görüntüleri dizisine dönüştürür (scale:2, max 6 sayfa). */
export async function pdfToBase64Images(buffer: Buffer): Promise<string[]> {
  const { pdf } = await import("pdf-to-img");
  const images: string[] = [];
  const document = await pdf(buffer, { scale: 2 });
  let page = 0;
  for await (const img of document) {
    if (page >= MAX_VISION_PAGES) break;
    images.push((img as Buffer).toString("base64"));
    page++;
  }
  return images;
}

/** Base64 görüntüyü GPT vision formatına çevirir. */
export function imageContent(b64: string) {
  return {
    type: "image_url" as const,
    image_url: { url: `data:image/png;base64,${b64}`, detail: "high" as const },
  };
}

/** Model yanıtından JSON çıkarır; başarısız olursa {} döner. */
export function parseJsonContent(content: string): any {
  try { return JSON.parse(content); } catch { /* fall through */ }
  const match = content.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* fall through */ }
  }
  return {};
}
