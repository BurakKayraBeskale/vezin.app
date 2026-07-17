/**
 * Vezin Tutarlılık Skoru
 *
 * Tek ya da çoklu beyanname JSON çıkarımlarını alır,
 * iç tutarlılık + çapraz kontrolleri çalıştırır,
 * 0-100 skor ve risk seviyesi döndürür.
 *
 * NOT: Yapay zeka kullanılmaz — tamamen kod taraflı.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface BeyanneVeri {
  alan: string;
  deger: string | number;
  birim?: string;
}

export interface BeyanneExtraction {
  dosya_adi?: string;
  belge_turu?: string;
  mukellef?: { unvan?: string; vergi_kimlik_no?: string; vergi_dairesi?: string } | string;
  donem?: string;
  veriler?: BeyanneVeri[];
  bolumler?: Array<{
    ad?: string;
    baslik?: string;
    name?: string;
    satirlar?: BeyanneVeri[];
    veriler?: BeyanneVeri[];
    rows?: BeyanneVeri[];
  }>;
  failed?: boolean;
  failedReason?: string;
}

export interface SkorKontrol {
  ad: string;
  aciklama: string;
  durum: "GECTI" | "BASARISIZ" | "BILGI";
  etki: number;           // 0 for passed/info, negative (e.g. -15) for failed
  agirlik: "kritik" | "orta" | "hafif";
  deger1?: number;
  deger1Etiket?: string;
  deger2?: number;
  deger2Etiket?: string;
  fark?: number;
  farkYuzde?: number;
}

export type RiskSeviyesi = "DUSUK_RISK" | "GOZDEN_GECIRILMELI" | "YUKSEK_RISK";

export interface TutarlilikSonuc {
  skor: number;           // 0-100
  risk: RiskSeviyesi;
  riskEtiketi: string;   // "Düşük Risk" | "Gözden Geçirilmeli" | "Yüksek Risk"
  kontroller: SkorKontrol[];
  hesaplanamadi: boolean;
}

// ── Private helpers ────────────────────────────────────────────────────────

function safeStr(val: any): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    const s = val.metin ?? val.text ?? val.unvan ?? val.value ?? val.deger ?? val.label ?? val.ad;
    if (s != null) return safeStr(s);
    return JSON.stringify(val);
  }
  return String(val);
}

function toNum(val: any): number {
  const s = safeStr(val).replace(/[^0-9.,-]/g, "").replace(",", ".");
  return parseFloat(s) || 0;
}

function flattenVeriler(ext: BeyanneExtraction): BeyanneVeri[] {
  const all: BeyanneVeri[] = [...(ext.veriler ?? [])];
  for (const bolum of ext.bolumler ?? []) {
    const rows = (bolum.satirlar ?? bolum.veriler ?? (bolum as any).rows ?? []) as BeyanneVeri[];
    if (Array.isArray(rows)) all.push(...rows);
  }
  return all;
}

function findField(veriler: BeyanneVeri[], keywords: string[]): number {
  const candidates: number[] = [];
  for (const v of veriler) {
    const alan = safeStr(v.alan ?? "").toLowerCase();
    for (const kw of keywords) {
      if (alan.includes(kw.toLowerCase())) {
        const n = toNum(v.deger);
        if (n > 0) candidates.push(n);
        break;
      }
    }
  }
  return candidates.length > 0 ? Math.max(...candidates) : 0;
}

function getVergiNo(ext: BeyanneExtraction): string {
  const mk = ext.mukellef;
  if (!mk || typeof mk === "string") return "";
  return safeStr((mk as any).vergi_kimlik_no ?? "").replace(/\D/g, "");
}

function hasType(exts: BeyanneExtraction[], ...keywords: string[]): boolean {
  return exts.some(e => keywords.some(kw => (e.belge_turu ?? "").toLowerCase().includes(kw)));
}

function findByType(exts: BeyanneExtraction[], ...keywords: string[]): BeyanneExtraction | undefined {
  return exts.find(e => keywords.some(kw => (e.belge_turu ?? "").toLowerCase().includes(kw)));
}

function riskFromSkor(skor: number): { risk: RiskSeviyesi; riskEtiketi: string } {
  if (skor >= 85) return { risk: "DUSUK_RISK",          riskEtiketi: "Düşük Risk" };
  if (skor >= 60) return { risk: "GOZDEN_GECIRILMELI",  riskEtiketi: "Gözden Geçirilmeli" };
  return             { risk: "YUKSEK_RISK",          riskEtiketi: "Yüksek Risk" };
}

// ── Single-document checks ─────────────────────────────────────────────────

/** 1. VKN (10 hane) / TCKN (11 hane) format doğrulaması — hafif −5 */
function checkVknTckn(ext: BeyanneExtraction): SkorKontrol[] {
  const vergiNo = getVergiNo(ext);
  if (!vergiNo) return [];

  if (vergiNo.length !== 10 && vergiNo.length !== 11) {
    return [{
      ad: "VKN/TCKN Doğrulama",
      aciklama: `Kimlik no "${vergiNo}" geçersiz uzunluk (${vergiNo.length} hane) — VKN 10, TCKN 11 hane olmalı`,
      durum: "BASARISIZ", etki: -5, agirlik: "hafif",
    }];
  }
  return [{
    ad: "VKN/TCKN Doğrulama",
    aciklama: `${vergiNo.length === 10 ? "VKN" : "TCKN"} format geçerli (${vergiNo.length} hane)`,
    durum: "GECTI", etki: 0, agirlik: "hafif",
  }];
}

/** 2. Dönem YYYY-MM veya YYYY formatında mı? — hafif −5 */
function checkDonemFormat(ext: BeyanneExtraction): SkorKontrol[] {
  const donem = safeStr(ext.donem ?? "").trim();
  if (!donem) {
    return [{
      ad: "Dönem / Tarih Formatı",
      aciklama: "Dönem bilgisi tespit edilemedi",
      durum: "BASARISIZ", etki: -5, agirlik: "hafif",
    }];
  }
  const valid =
    /^\d{4}-\d{2}$/.test(donem) ||
    /^\d{4}\/\d{2}$/.test(donem) ||
    /^\d{2}\/\d{4}$/.test(donem) ||
    /^\d{4}$/.test(donem);
  if (!valid) {
    return [{
      ad: "Dönem / Tarih Formatı",
      aciklama: `Dönem "${donem}" tanınan bir format değil (beklenen: YYYY-MM veya YYYY)`,
      durum: "BASARISIZ", etki: -5, agirlik: "hafif",
    }];
  }
  return [{
    ad: "Dönem / Tarih Formatı",
    aciklama: `Dönem "${donem}" — geçerli format`,
    durum: "GECTI", etki: 0, agirlik: "hafif",
  }];
}

/** 3. KDV: Matrah × oran ≈ hesaplanan KDV (satır bazında %1 tolerans) — kritik −15 */
function checkKdvMatrahOran(ext: BeyanneExtraction): SkorKontrol[] {
  const tur = (ext.belge_turu ?? "").toLowerCase();
  if (!tur.includes("kdv") && !tur.includes("katma")) return [];

  // Try to find (oran, matrah, kdv) triplets from bolumler with % in name
  const triplets: Array<{ oran: number; matrah: number; kdv: number; bolumAdi: string }> = [];
  for (const bolum of ext.bolumler ?? []) {
    const bolumAdi = safeStr(bolum.ad ?? bolum.baslik ?? (bolum as any).name ?? "");
    const rateMatch = bolumAdi.match(/\b(\d+)\s*%/) ?? bolumAdi.match(/yüzde\s*(\d+)/i);
    if (!rateMatch) continue;
    const oran = parseInt(rateMatch[1]);
    if (![0, 1, 8, 10, 18, 20, 25].includes(oran)) continue;
    if (oran === 0) continue; // %0 KDV: matrah × 0 = 0 always passes trivially

    const satirlar = (bolum.satirlar ?? bolum.veriler ?? (bolum as any).rows ?? []) as BeyanneVeri[];
    const matrah   = findField(satirlar, ["matrah", "bedel", "teslim"]);
    const kdv      = findField(satirlar, ["kdv", "vergi", "hesaplanan"]);
    if (matrah > 0 && kdv > 0) {
      triplets.push({ oran, matrah, kdv, bolumAdi });
    }
  }

  if (triplets.length === 0) {
    // Fallback: check implied rate from flat veriler
    const veriler  = flattenVeriler(ext);
    const hesaplanan = findField(veriler, ["hesaplanan kdv", "hesaplanan katma değer vergisi", "hesaplanan"]);
    const matrah     = findField(veriler, ["matrah", "teslim", "vergi matrahı", "toplam matrah"]);
    if (matrah > 0 && hesaplanan > 0) {
      const implied  = (hesaplanan / matrah) * 100;
      const standard = [1, 8, 10, 18, 20, 25];
      const nearest  = standard.reduce((b, r) => Math.abs(r - implied) < Math.abs(b - implied) ? r : b);
      if (Math.abs(implied - nearest) > 3) {
        return [{
          ad: "Matrah × KDV Oranı Tutarlılığı",
          aciklama: `Hesaplanan KDV / Matrah = %${implied.toFixed(1)} — standart oranlardan (%1, %8, %10, %20) belirgin sapma`,
          durum: "BASARISIZ", etki: -15, agirlik: "kritik",
          deger1: matrah, deger1Etiket: "Matrah",
          deger2: hesaplanan, deger2Etiket: "Hesaplanan KDV",
        }];
      }
      return [{
        ad: "Matrah × KDV Oranı Tutarlılığı",
        aciklama: `Zımni KDV oranı %${implied.toFixed(1)} — standart oran %${nearest} ile uyumlu`,
        durum: "GECTI", etki: 0, agirlik: "kritik",
      }];
    }
    return []; // Can't check without data
  }

  const failed: SkorKontrol[] = [];
  for (const { oran, matrah, kdv, bolumAdi } of triplets) {
    const expected = matrah * oran / 100;
    const diff     = Math.abs(expected - kdv);
    const diffPct  = expected > 0 ? (diff / expected) * 100 : 0;
    if (diffPct > 1) {
      failed.push({
        ad: "Matrah × KDV Oranı Tutarlılığı",
        aciklama: `"${bolumAdi}": ${matrah.toLocaleString("tr-TR")} × %${oran} = ${expected.toLocaleString("tr-TR")} ₺ beklenir, beyannamede ${kdv.toLocaleString("tr-TR")} ₺ — %${diffPct.toFixed(1)} fark`,
        durum: "BASARISIZ", etki: 0, agirlik: "kritik",
        deger1: expected, deger1Etiket: "Hesap. (Matrah×Oran)",
        deger2: kdv,      deger2Etiket: "Beyannamedeki KDV",
        fark: diff, farkYuzde: diffPct,
      });
    }
  }
  if (failed.length > 0) {
    failed[0].etki = -15; // deduct once for the whole check
    return failed;
  }
  return [{
    ad: "Matrah × KDV Oranı Tutarlılığı",
    aciklama: `${triplets.length} KDV oranı grubu kontrol edildi — matrah × oran ≈ KDV, uyumlu`,
    durum: "GECTI", etki: 0, agirlik: "kritik",
  }];
}

/** 4. KDV: Ödenecek ve devreden aynı anda pozitif olamaz — kritik −15 */
function checkOdenecekDevreden(ext: BeyanneExtraction): SkorKontrol[] {
  const tur = (ext.belge_turu ?? "").toLowerCase();
  if (!tur.includes("kdv") && !tur.includes("katma")) return [];

  const veriler    = flattenVeriler(ext);
  const odenecek   = findField(veriler, ["ödenecek kdv", "ödenmesi gereken kdv", "ödenecek"]);
  const devreden   = findField(veriler, ["devreden kdv", "sonraki döneme devreden", "devreden"]);

  if (odenecek > 0 && devreden > 0) {
    return [{
      ad: "KDV Ödenecek / Devreden Mantık",
      aciklama: "Ödenecek KDV ve Devreden KDV aynı anda pozitif olamaz — çelişki tespit edildi",
      durum: "BASARISIZ", etki: -15, agirlik: "kritik",
      deger1: odenecek, deger1Etiket: "Ödenecek KDV",
      deger2: devreden, deger2Etiket: "Devreden KDV",
    }];
  }
  if (odenecek > 0 || devreden > 0) {
    return [{
      ad: "KDV Ödenecek / Devreden Mantık",
      aciklama: odenecek > 0
        ? `Ödenecek KDV: ${odenecek.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺ — tutarlı`
        : `Devreden KDV: ${devreden.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺ — tutarlı`,
      durum: "GECTI", etki: 0, agirlik: "kritik",
    }];
  }
  return [];
}

/** 5. KDV: Hesaplanan − İndirilecek ≈ Ödenecek/Devreden (%1 tolerans) — orta −10 */
function checkKdvToplam(ext: BeyanneExtraction): SkorKontrol[] {
  const tur = (ext.belge_turu ?? "").toLowerCase();
  if (!tur.includes("kdv") && !tur.includes("katma")) return [];

  const veriler     = flattenVeriler(ext);
  const hesaplanan  = findField(veriler, ["hesaplanan kdv", "hesaplanan katma değer vergisi"]);
  const indirilecek = findField(veriler, ["indirilecek kdv", "toplam indirim", "indirilecek katma"]);
  const odenecek    = findField(veriler, ["ödenecek kdv", "ödenmesi gereken kdv", "ödenecek"]);
  const devreden    = findField(veriler, ["devreden kdv", "sonraki döneme devreden", "devreden"]);
  const sonuc       = odenecek > 0 ? odenecek : devreden;

  if (hesaplanan > 0 && indirilecek > 0 && sonuc > 0) {
    const expected = hesaplanan - indirilecek;
    const diff     = Math.abs(expected - sonuc);
    const diffPct  = hesaplanan > 0 ? (diff / hesaplanan) * 100 : 0;
    if (diffPct > 1) {
      return [{
        ad: "KDV Toplamlar Tutarlılığı",
        aciklama: `Hesaplanan(${hesaplanan.toLocaleString("tr-TR")}) − İndirilecek(${indirilecek.toLocaleString("tr-TR")}) = ${expected.toLocaleString("tr-TR")} ₺, beyannamede ${sonuc.toLocaleString("tr-TR")} ₺ — %${diffPct.toFixed(1)} fark`,
        durum: "BASARISIZ", etki: -10, agirlik: "orta",
        deger1: expected, deger1Etiket: "Hesap. − İndir.",
        deger2: sonuc,    deger2Etiket: odenecek > 0 ? "Ödenecek KDV" : "Devreden KDV",
        fark: diff, farkYuzde: diffPct,
      }];
    }
    return [{
      ad: "KDV Toplamlar Tutarlılığı",
      aciklama: `Hesaplanan − İndirilecek ≈ ${odenecek > 0 ? "Ödenecek" : "Devreden"} KDV — uyumlu (%${diffPct.toFixed(1)} fark)`,
      durum: "GECTI", etki: 0, agirlik: "orta",
    }];
  }
  return [];
}

/** 6. Bölüm toplamları satır değerleriyle uyumlu mu? — orta −10 */
function checkToplamlar(ext: BeyanneExtraction): SkorKontrol[] {
  if (!ext.bolumler || ext.bolumler.length === 0) return [];

  const failed: SkorKontrol[] = [];
  let checkedAny = false;

  for (const bolum of ext.bolumler) {
    const satirlar = (bolum.satirlar ?? bolum.veriler ?? (bolum as any).rows ?? []) as BeyanneVeri[];
    if (!Array.isArray(satirlar) || satirlar.length < 3) continue;

    const totRows = satirlar.filter((v: any) => /\btoplam\b/i.test(safeStr(v.alan ?? "")));
    const detRows = satirlar.filter((v: any) => !/\btoplam\b/i.test(safeStr(v.alan ?? "")));
    if (totRows.length === 0 || detRows.length < 2) continue;

    for (const totRow of totRows) {
      const totVal     = toNum((totRow as any).deger);
      if (totVal <= 0) continue;
      const sumDetails = detRows.reduce((s: number, v: any) => {
        const n = toNum(v.deger);
        return s + (n > 0 ? n : 0);
      }, 0);
      if (sumDetails <= 0) continue;
      checkedAny = true;

      const diff    = Math.abs(totVal - sumDetails);
      const diffPct = (diff / totVal) * 100;
      const bolumAdi = safeStr(bolum.ad ?? bolum.baslik ?? (bolum as any).name ?? "Bölüm");

      if (diffPct > 5) {
        failed.push({
          ad: "Toplamlar Tutarlılığı",
          aciklama: `"${bolumAdi}" — "${safeStr((totRow as any).alan)}" (${totVal.toLocaleString("tr-TR")}) ₺ ≠ satır toplamı ${sumDetails.toLocaleString("tr-TR")} ₺ (%${diffPct.toFixed(1)} fark)`,
          durum: "BASARISIZ", etki: 0, agirlik: "orta",
          deger1: totVal,    deger1Etiket: "Beyanname Toplamı",
          deger2: sumDetails, deger2Etiket: "Satırların Toplamı",
          fark: diff, farkYuzde: diffPct,
        });
      }
    }
  }

  if (failed.length > 0) {
    failed[0].etki = -10;
    return failed;
  }
  if (checkedAny) {
    return [{
      ad: "Toplamlar Tutarlılığı",
      aciklama: "Bölüm toplamları satır değerleriyle uyumlu",
      durum: "GECTI", etki: 0, agirlik: "orta",
    }];
  }
  return [];
}

/** 7. Anormal negatif / aşırı büyük tutar — hafif −5 */
function checkAnormalTutar(ext: BeyanneExtraction): SkorKontrol[] {
  const veriler = flattenVeriler(ext);
  const WATCH_KEYWORDS = ["ödenecek", "tahakkuk", "vergi", "prim", "kdv", "matrah", "hasılat", "kazanç", "tutar"];
  const watched = veriler.filter(v => {
    const alan = safeStr(v.alan ?? "").toLowerCase();
    return WATCH_KEYWORDS.some(kw => alan.includes(kw));
  });

  let hasNeg = false, hasHuge = false;
  const results: SkorKontrol[] = [];

  for (const v of watched) {
    const alan = safeStr(v.alan ?? "");
    const n    = toNum(v.deger);
    if (n < -100 && !hasNeg) {
      hasNeg = true;
      results.push({
        ad: "Anormal Tutar Kontrolü",
        aciklama: `"${alan}" alanında negatif değer: ${n.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺ — iade durumu veya veri hatası olabilir`,
        durum: "BASARISIZ", etki: -5, agirlik: "hafif",
        deger1: n, deger1Etiket: alan,
      });
    }
    if (n > 10_000_000 && !hasHuge) {
      hasHuge = true;
      results.push({
        ad: "Anormal Tutar Kontrolü",
        aciklama: `"${alan}" alanında olağandışı yüksek değer: ${n.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺ — 10M ₺ üzeri`,
        durum: "BASARISIZ", etki: hasNeg ? 0 : -5, agirlik: "hafif",
        deger1: n, deger1Etiket: alan,
      });
    }
  }

  if (!hasNeg && !hasHuge && watched.length > 0) {
    results.push({
      ad: "Anormal Tutar Kontrolü",
      aciklama: "Anormal negatif veya aşırı yüksek tutar tespit edilmedi",
      durum: "GECTI", etki: 0, agirlik: "hafif",
    });
  }
  return results;
}

function runTekBeyannameKontrolleri(ext: BeyanneExtraction): SkorKontrol[] {
  return [
    ...checkVknTckn(ext),
    ...checkDonemFormat(ext),
    ...checkKdvMatrahOran(ext),
    ...checkOdenecekDevreden(ext),
    ...checkKdvToplam(ext),
    ...checkToplamlar(ext),
    ...checkAnormalTutar(ext),
  ];
}

// ── Multi-document checks ──────────────────────────────────────────────────

function checkVergiNoTutarliligi(exts: BeyanneExtraction[]): SkorKontrol[] {
  const nos = exts.map(getVergiNo).filter(Boolean);
  if (nos.length < 2) return [];
  const unique = [...new Set(nos)];
  if (unique.length > 1) {
    return [{
      ad: "Mükellef Vergi No Tutarlılığı",
      aciklama: `Farklı vergi numaraları: ${unique.join(", ")} — karışık mükellef riski`,
      durum: "BASARISIZ", etki: -10, agirlik: "orta",
    }];
  }
  return [{
    ad: "Mükellef Vergi No Tutarlılığı",
    aciklama: `Tüm beyannamelerde aynı VKN/TCKN: ${unique[0]}`,
    durum: "GECTI", etki: 0, agirlik: "orta",
  }];
}

function checkDonemCakismasi(exts: BeyanneExtraction[]): SkorKontrol[] {
  const counts: Record<string, number> = {};
  for (const e of exts) {
    const t = (e.belge_turu ?? "").trim().toLowerCase();
    if (t) counts[t] = (counts[t] ?? 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, n]) => n > 1)
    .map(([tur, n]) => ({
      ad: `Dönem Çakışması — ${tur.toUpperCase()}`,
      aciklama: `Aynı türden ${n} beyanname yüklendi — dönem çakışması olabilir`,
      durum: "BASARISIZ" as const, etki: -5, agirlik: "hafif" as const,
    }));
}

function checkMuhtasarSgk(exts: BeyanneExtraction[]): SkorKontrol[] {
  const muhtasar = findByType(exts, "muhtasar", "stopaj");
  const sgk      = findByType(exts, "sgk", "sosyal güvenlik", "bildirge");
  if (!muhtasar || !sgk) return [];

  const muhtV = flattenVeriler(muhtasar);
  const sgkV  = flattenVeriler(sgk);
  const muhtasarMatrah = findField(muhtV, ["ücret ödemeleri", "ücret stopaj", "ücret matrah", "brüt ücret", "maaş", "ücret"]);
  const sgkPrime       = findField(sgkV,  ["prime esas kazanç", "prime esas", "sigorta primine esas", "brüt kazanç", "kazanç"]);

  if (muhtasarMatrah > 0 && sgkPrime > 0) {
    const diff    = Math.abs(muhtasarMatrah - sgkPrime);
    const diffPct = (diff / Math.max(muhtasarMatrah, sgkPrime)) * 100;
    const failed  = diffPct > 10;
    return [{
      ad: "Muhtasar Ücret Matrahı ↔ SGK Prime Esas Kazanç",
      aciklama: failed
        ? `%${diffPct.toFixed(1)} fark — eşik %10, kontrol gerekli`
        : `%${diffPct.toFixed(1)} fark — kabul edilebilir`,
      durum: failed ? "BASARISIZ" : "GECTI", etki: failed ? -10 : 0, agirlik: "orta",
      deger1: muhtasarMatrah, deger1Etiket: "Muhtasar Ücret Matrahı",
      deger2: sgkPrime,       deger2Etiket: "SGK Prime Esas Kazanç",
      fark: diff, farkYuzde: diffPct,
    }];
  }
  return [{
    ad: "Muhtasar ↔ SGK Karşılaştırması",
    aciklama: "Karşılaştırılabilir alanlar çıkarılamadı (manuel kontrol önerilir)",
    durum: "BILGI", etki: 0, agirlik: "orta",
  }];
}

function checkKdvGecici(exts: BeyanneExtraction[]): SkorKontrol[] {
  const kdv    = findByType(exts, "kdv", "katma değer");
  const gecici = findByType(exts, "geçici", "gecici");
  if (!kdv || !gecici) return [];

  const kdvV    = flattenVeriler(kdv);
  const geciciV = flattenVeriler(gecici);
  const kdvTeslim     = findField(kdvV,    ["teslim ve hizmet", "teslim bedeli", "matrah", "vergilendirilecek teslim", "toplam matrah"]);
  const geciciHasilat = findField(geciciV, ["hasılat", "brüt satış", "net satış", "toplam gelir", "matrah"]);

  if (kdvTeslim > 0 && geciciHasilat > 0) {
    const diff    = Math.abs(kdvTeslim - geciciHasilat);
    const diffPct = (diff / Math.max(kdvTeslim, geciciHasilat)) * 100;
    const failed  = diffPct > 20;
    return [{
      ad: "KDV Teslim Bedeli ↔ Geçici Vergi Hasılatı",
      aciklama: failed
        ? `%${diffPct.toFixed(1)} fark — dönemsel uyumsuzluk olabilir`
        : `%${diffPct.toFixed(1)} fark — uyumlu`,
      durum: failed ? "BASARISIZ" : "GECTI", etki: failed ? -10 : 0, agirlik: "orta",
      deger1: kdvTeslim,      deger1Etiket: "KDV Teslim Bedeli",
      deger2: geciciHasilat,  deger2Etiket: "Geçici Vergi Hasılatı",
      fark: diff, farkYuzde: diffPct,
    }];
  }
  return [];
}

function checkEksikBeyanname(exts: BeyanneExtraction[]): SkorKontrol[] {
  const missing: string[] = [];
  if (hasType(exts, "kdv", "katma değer") && !hasType(exts, "muhtasar", "stopaj"))
    missing.push("KDV mevcut ancak Muhtasar yüklenmedi");
  if (hasType(exts, "muhtasar", "stopaj") && !hasType(exts, "sgk"))
    missing.push("Muhtasar mevcut ancak SGK bildirimi yüklenmedi");
  if (hasType(exts, "kurumlar", "gelir") && !hasType(exts, "geçici", "gecici"))
    missing.push("Kurumlar/Gelir Vergisi mevcut ancak Geçici Vergi yüklenmedi");
  return missing.map(m => ({
    ad: "Eksik Beyanname Tespiti",
    aciklama: m,
    durum: "BILGI" as const, etki: 0, agirlik: "hafif" as const,
  }));
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Ana skor hesaplama fonksiyonu.
 * Tek bir extraction ya da extraction dizisi alır.
 * Tek eleman: yalnızca iç tutarlılık kontrolleri.
 * Çoklu eleman: iç tutarlılık + beyannameler arası çapraz kontroller.
 */
export function hesaplaTutarlilik(
  input: BeyanneExtraction | BeyanneExtraction[],
): TutarlilikSonuc {
  const exts      = Array.isArray(input) ? input : [input];
  const validExts = exts.filter(e => !e.failed);

  if (validExts.length === 0) {
    return {
      skor: 0, risk: "YUKSEK_RISK", riskEtiketi: "Skor Hesaplanamadı",
      kontroller: [], hesaplanamadi: true,
    };
  }

  const kontroller: SkorKontrol[] = [];
  const multi = validExts.length > 1;

  for (const ext of validExts) {
    const single = runTekBeyannameKontrolleri(ext);
    if (multi) {
      const label = safeStr(ext.belge_turu) || safeStr(ext.dosya_adi ?? "").replace(/\.pdf$/i, "") || "Beyanname";
      kontroller.push(...single.map(k => ({ ...k, ad: `${k.ad} — ${label}` })));
    } else {
      kontroller.push(...single);
    }
  }

  if (multi) {
    kontroller.push(
      ...checkVergiNoTutarliligi(validExts),
      ...checkDonemCakismasi(validExts),
      ...checkMuhtasarSgk(validExts),
      ...checkKdvGecici(validExts),
      ...checkEksikBeyanname(validExts),
    );
  }

  const totalDeduction = kontroller.reduce((s, k) => s + Math.abs(Math.min(0, k.etki)), 0);
  const skor = Math.max(0, 100 - totalDeduction);
  const { risk, riskEtiketi } = riskFromSkor(skor);

  return { skor, risk, riskEtiketi, kontroller, hesaplanamadi: false };
}

/**
 * SkorKontrol → eski CheckResult formatı dönüşümü.
 * Çapraz kontrol route'u ve Excel route'u için backward-compat.
 */
export function skorKontrolToCheckResult(k: SkorKontrol): {
  name: string; detail: string;
  value1?: number; value1Label?: string;
  value2?: number; value2Label?: string;
  diff?: number; diffPercent?: number;
  status: "UYGUN" | "UYARI" | "BİLGİ";
} {
  return {
    name:       k.ad,
    detail:     k.aciklama,
    value1:     k.deger1,
    value1Label: k.deger1Etiket,
    value2:     k.deger2,
    value2Label: k.deger2Etiket,
    diff:       k.fark,
    diffPercent: k.farkYuzde,
    status:     k.durum === "GECTI" ? "UYGUN" : k.durum === "BASARISIZ" ? "UYARI" : "BİLGİ",
  };
}

/**
 * ExcelJS workbook'una "TUTARLILIK" sayfası ekler.
 * Her üç route tarafından çağrılır.
 */
export function tutarlilikSayfasiEkle(wb: any, tutarlilik: TutarlilikSonuc): void {
  function solidFill(argb: string) {
    return { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } };
  }

  const ORANGE    = "FFF57C28";
  const DARK_BLUE = "FF1F3864";
  const WHITE     = "FFFFFFFF";
  const GREEN_BG  = "FFE2EFDA";
  const GREEN_FG  = "FF375623";
  const YELLOW_BG = "FFFFF2CC";
  const YELLOW_FG = "FF7F6000";
  const RED_BG    = "FFFFE0E0";
  const RED_FG    = "FFC00000";
  const GRAY_LT   = "FFF5F5F5";

  const ws = wb.addWorksheet("TUTARLILIK");
  ws.pageSetup = { paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "portrait" };
  ws.columns   = [{ width: 38 }, { width: 12 }, { width: 8 }, { width: 46 }];

  // Row 1: Main title
  ws.mergeCells("A1:D1");
  const t1 = ws.getCell("A1");
  t1.value = "VEZİN TUTARLILIK SKORU"; t1.fill = solidFill(ORANGE);
  t1.font  = { bold: true, size: 14, color: { argb: WHITE } };
  t1.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 30;

  // Row 2: Score + risk
  const { skor, risk, riskEtiketi, hesaplanamadi } = tutarlilik;
  const [scoreBg, scoreFg] =
    hesaplanamadi   ? [GRAY_LT, "FF888888"] :
    risk === "DUSUK_RISK"         ? [GREEN_BG,  GREEN_FG]  :
    risk === "GOZDEN_GECIRILMELI" ? [YELLOW_BG, YELLOW_FG] :
                                    [RED_BG,    RED_FG];

  ws.mergeCells("A2:B2");
  const scoreCell = ws.getCell("A2");
  scoreCell.value = hesaplanamadi ? "—" : skor;
  scoreCell.fill  = solidFill(scoreBg);
  scoreCell.font  = { bold: true, size: 28, color: { argb: scoreFg } };
  scoreCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 52;

  ws.mergeCells("C2:D2");
  const riskCell = ws.getCell("C2");
  riskCell.value = hesaplanamadi ? "Skor Hesaplanamadı — Belge Okunamadı" : `${riskEtiketi}\n(100 üzerinden ${skor} puan)`;
  riskCell.fill  = solidFill(scoreBg);
  riskCell.font  = { bold: true, size: 12, color: { argb: scoreFg } };
  riskCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true, indent: 1 };

  // Row 3: Check counts summary
  if (!hesaplanamadi) {
    const { kontroller } = tutarlilik;
    const gecti     = kontroller.filter(k => k.durum === "GECTI").length;
    const basarisiz = kontroller.filter(k => k.durum === "BASARISIZ").length;
    const bilgi     = kontroller.filter(k => k.durum === "BILGI").length;

    ws.mergeCells("A3:D3");
    const summaryCell = ws.getCell("A3");
    summaryCell.value = `${gecti} kontrol geçti  ·  ${basarisiz} sorun tespit edildi  ·  ${bilgi} bilgi notu`;
    summaryCell.fill  = solidFill(DARK_BLUE);
    summaryCell.font  = { size: 10, color: { argb: WHITE } };
    summaryCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(3).height = 18;
  }

  ws.getRow(4).height = 6; // spacer

  // Row 5: Column headers
  const hRow = ws.getRow(5);
  hRow.height = 22;
  [["Kontrol", "A5"], ["Durum", "B5"], ["Etki", "C5"], ["Açıklama", "D5"]].forEach(([h, addr]) => {
    const c = ws.getCell(addr);
    c.value = h; c.fill = solidFill(DARK_BLUE);
    c.font  = { bold: true, size: 10, color: { argb: WHITE } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = { top: { style: "medium" }, left: { style: "thin" }, bottom: { style: "medium" }, right: { style: "thin" } };
  });

  // Data rows
  let dataRow = 6;
  const kontroller = tutarlilik.hesaplanamadi ? [] : tutarlilik.kontroller;

  for (const k of kontroller) {
    const [bg, fg] =
      k.durum === "BASARISIZ" ? [RED_BG,    RED_FG]    :
      k.durum === "GECTI"     ? [GREEN_BG,  GREEN_FG]  :
                                [YELLOW_BG, YELLOW_FG];

    const row = ws.getRow(dataRow);
    row.getCell(1).value = k.ad;
    row.getCell(2).value = k.durum === "GECTI" ? "UYGUN" : k.durum === "BASARISIZ" ? "BAŞARISIZ" : "BİLGİ";
    row.getCell(3).value = k.etki !== 0 ? k.etki : "";
    row.getCell(4).value = k.aciklama;

    for (let i = 1; i <= 4; i++) {
      const c = row.getCell(i);
      c.fill = solidFill(bg);
      c.font = { size: 9, color: { argb: i === 2 ? fg : "FF000000" }, bold: i === 2 };
      c.alignment = {
        horizontal: i === 3 ? "center" : i === 2 ? "center" : "left",
        vertical: "middle", wrapText: i === 1 || i === 4, indent: i === 1 || i === 4 ? 1 : 0,
      };
      c.border = { top: { style: "hair" }, left: { style: "thin" }, bottom: { style: "hair" }, right: { style: "thin" } };
    }
    row.height = k.durum === "GECTI" ? 16 : 20;
    dataRow++;
  }

  // Dipnot
  dataRow += 2;
  ws.mergeCells(`A${dataRow}:D${dataRow}`);
  const dipnot = ws.getCell(`A${dataRow}`);
  dipnot.value = "Vezin Tutarlılık Skoru resmî bir GİB değerlendirmesi değildir; iç kontrol amaçlıdır.";
  dipnot.font  = { italic: true, size: 8, color: { argb: "FF888888" } };
  dipnot.alignment = { horizontal: "left", vertical: "middle", wrapText: true, indent: 1 };
  dipnot.fill  = solidFill(GRAY_LT);
  ws.getRow(dataRow).height = 16;
}
