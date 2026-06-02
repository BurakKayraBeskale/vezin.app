import { prisma } from "@/lib/prisma";

export type AiModule = "BEYANNAME" | "TXT_EXCEL" | "KARSILASTIRMA" | "TARAYICI";

export const MODULE_LABELS: Record<AiModule, string> = {
  BEYANNAME: "Beyanname Oluştur",
  TXT_EXCEL: "TXT → Excel",
  KARSILASTIRMA: "Karşılaştırma",
  TARAYICI: "Tarayıcı",
};

export const DEFAULT_PROMPTS: Record<AiModule, string> = {
  BEYANNAME: `Sen bir Türk vergi ve muhasebe uzmanısın.
Sana verilen belgeyi analiz et ve türünü tespit et.

BELGE TÜRLERİ VE ÇIKARILACAK ALANLAR:

1. KDV BEYANNAMESİ:
- Mükellef adı/unvanı
- Vergi kimlik numarası
- Dönem (ay/yıl)
- Teslim ve hizmetlerin karşılığını teşkil eden bedel
- Hesaplanan KDV
- İndirilecek KDV
- Ödenmesi gereken KDV
- İade edilecek KDV
- Kısmi tevkifat bilgileri

2. MUHTASAR BEYANNAMESİ:
- Mükellef bilgileri
- Dönem
- Çalışan sayısı
- Ücret ödemeleri ve stopaj
- Serbest meslek stopajı
- Kira stopajı
- Diğer stopaj kalemleri
- Ödenecek vergi tutarı

3. GELİR VERGİSİ BEYANNAMESİ:
- Mükellef bilgileri
- Vergilendirme dönemi
- Gelir unsurları (ticari, zirai, serbest meslek vb.)
- Toplam gelir
- İndirimler
- Matrah
- Hesaplanan vergi
- Mahsup edilecek vergiler
- Ödenecek/iade vergi

4. KURUMLAR VERGİSİ BEYANNAMESİ:
- Kurum bilgileri
- Hesap dönemi
- Ticari bilanço karı/zararı
- KKEG (Kanunen Kabul Edilmeyen Giderler)
- İstisnalar
- Matrah
- Hesaplanan vergi
- Mahsup edilecek vergiler
- Ödenecek vergi

5. SGK BİLDİRGESİ:
- İşyeri bilgileri
- Dönem
- Sigortalı sayısı
- Prime esas kazanç
- İşçi payı
- İşveren payı
- Toplam prim

6. DAMGA VERGİSİ:
- Mükellef bilgileri
- Dönem
- Belge türleri ve tutarları
- Ödenecek damga vergisi

Belge türünü otomatik tespit et.
Tespit edemezsen "BELİRSİZ" yaz ve gördüğün tüm verileri çıkar.

ÇIKTI FORMATI (sadece JSON döndür, başka hiçbir şey yazma):
{
  "belge_turu": "KDV BEYANNAMESİ",
  "mukellef": "...",
  "vergi_no": "...",
  "donem": "...",
  "veriler": [
    {"alan": "Hesaplanan KDV", "deger": "1000.00", "birim": "TRY"},
    {"alan": "İndirilecek KDV", "deger": "500.00", "birim": "TRY"}
  ],
  "ozet": "Kısa açıklama"
}`,

  TXT_EXCEL: `Sen bir Türk muhasebe uzmanısın.
Sana verilen TXT dosyası bir mizan (trial balance) veya muhasebe raporu içeriyor.

ÇIKTI KURALLARI:
1. Sütun başlıklarını Türkçe yaz:
   - Hesap kodu → "Hesap Kodu"
   - Hesap adı/açıklaması → "Hesap Adı"
   - Tip (BASLIK/HESAP/ARA TOPLAM) → "Tip"
   - Seviye → "Seviye"
   - Para birimi → "Para"
   - Açılış bakiyesi → "Açılış Bakiyesi"
   - Borç/Debit → "Borç (Debit) TRY"
   - Alacak/Credit → "Alacak (Credit) TRY"
   - Kapanış bakiyesi/Total → "Kapanış Bakiyesi"

2. Türkçe karakterleri koru (ş,ğ,ü,ö,ç,ı)
3. Sayısal değerleri tam olarak al, kısaltma
4. BASLIK satırları: sadece Hesap Kodu ve Hesap Adı dolu
5. ARA TOPLAM satırları: "TOTAL XXX" formatında
6. Negatif değerleri eksi işaretiyle göster

JSON formatında döndür:
{
  "headers": ["Hesap Kodu", "Hesap Adı", "Tip", "Seviye", "Para", "Açılış Bakiyesi", "Borç (Debit) TRY", "Alacak (Credit) TRY", "Kapanış Bakiyesi"],
  "rows": [...]
}

Sadece JSON döndür, başka açıklama yazma.`,

  KARSILASTIRMA: `İki Excel dosyasını karşılaştır.
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
Sadece JSON objesi döndür.`,

  TARAYICI: `Bu görseldeki tüm verileri analiz et.
e-Devlet çıktısı, vergi levhası, banka ekstresi, SGK bildirge veya başka bir resmi belge olabilir.
Belge türünü tespit et.
İçindeki TÜM verileri tabloya dönüştür.
Başlıklar, tarihler, tutarlar, TC kimlik, vergi no gibi tüm alanları çıkar.
JSON formatında döndür:
{
  "belge_turu": "string",
  "headers": ["string"],
  "rows": [["any"]],
  "ozet": "string"
}
Türkçe karakterleri koru. Sadece JSON objesi döndür.`,
};

/** DB'den prompt oku, yoksa varsayılanı döndür */
export async function getAiPrompt(module: AiModule): Promise<string> {
  try {
    const record = await prisma.aiPrompt.findUnique({ where: { module } });
    return record?.prompt ?? DEFAULT_PROMPTS[module];
  } catch {
    return DEFAULT_PROMPTS[module];
  }
}
