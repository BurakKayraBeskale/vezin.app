/**
 * Rotasyon — VKN ile arama (dört sekmenin ortak eşleştiricisi, lib/rotasyon.ts)
 *
 *   A1  Tam VKN ile arama doğru işletmeyi döndürüyor
 *   A2  Kısmi VKN (son 4 hane / ilk haneler) ile arama çalışıyor
 *   A3  Boşluklu / noktalı / tireli VKN girişi eşleşiyor
 *   A4  Unvan araması eskisi gibi (Türkçe harf duyarlı, alt dize) — regresyon
 *   A5  Sekmeye özgü ek alanlar (sözleşme no, denetçi adı) korunuyor
 *   A6  Arama + durum filtresi birlikte uygulanıyor
 */

import { describe, it, expect } from "vitest";
import {
  durumFiltresiEslesir,
  hesaplaRotasyon,
  rotasyonAramaEslesir,
  rotasyonAramaSorgusu,
  type RotasyonAyarlar,
  type RotasyonDurumFiltresi,
} from "../../lib/rotasyon";

const ISLETMELER = [
  { id: "a", unvan: "İSTANBUL IŞIK GIDA A.Ş.", vkn: "1234567890", donemler: [2020, 2021, 2022, 2023, 2024, 2025, 2026] },
  { id: "b", unvan: "Ankara Çelik Sanayi Ltd. Şti.", vkn: "9876543210", donemler: [2025, 2026] },
  { id: "c", unvan: "Izmir Lojistik A.Ş.", vkn: "5550007890", donemler: [2024, 2025, 2026] },
  { id: "d", unvan: "Şahıs İşletmesi", vkn: "11122233344", donemler: [2026] }, // TCKN (11 hane)
];

const AYAR: RotasyonAyarlar = { cariDonem: 2026, azamiSure: 7, zorunluAra: 3, uyariEsigi: 3 };

/** Sekmelerin uyguladığı sırayla: arama (unvan / VKN) + durum filtresi. */
function suz(arama: string, durum: RotasyonDurumFiltresi = "all"): string[] {
  const sorgu = rotasyonAramaSorgusu(arama);
  return ISLETMELER.filter((i) => rotasyonAramaEslesir(sorgu, i))
    .filter((i) => durumFiltresiEslesir(durum, hesaplaRotasyon(i.donemler, AYAR, AYAR.cariDonem)))
    .map((i) => i.id);
}

describe("A1 — tam VKN", () => {
  it("10 haneli VKN yalnız ilgili işletmeyi döndürür", () => {
    expect(suz("1234567890")).toEqual(["a"]);
    expect(suz("9876543210")).toEqual(["b"]);
    expect(suz("5550007890")).toEqual(["c"]);
  });

  it("11 haneli TCKN tam girişi yalnız o kaydı döndürür", () => {
    expect(suz("11122233344")).toEqual(["d"]);
    expect(suz("111 222 333 44")).toEqual(["d"]);
  });
});

describe("A2 — kısmi VKN", () => {
  it("son 4 hane", () => {
    expect(suz("7890")).toEqual(["a", "c"]);
    expect(suz("3210")).toEqual(["b"]);
  });

  it("ilk haneler", () => {
    expect(suz("987")).toEqual(["b"]);
    expect(suz("555")).toEqual(["c"]);
  });
});

describe("A3 — ayraçlı VKN girişi", () => {
  it('"123 456 7890", "123.456.7890", "987-654-3210" ve baş/son boşluk eşleşir', () => {
    expect(suz("987 654 3210")).toEqual(["b"]);
    expect(suz("987.654.3210")).toEqual(["b"]);
    expect(suz("987-654-3210")).toEqual(["b"]);
    expect(suz("  555 000 7890  ")).toEqual(["c"]);
    expect(rotasyonAramaSorgusu("123 456.7890")?.vknRakamlari).toBe("1234567890");
  });

  it("harf içeren sorgu VKN araması sayılmaz (unvandaki rakam değil, VKN eşleşmesi yok)", () => {
    expect(rotasyonAramaSorgusu("A.Ş. 2")?.vknRakamlari).toBeNull();
    expect(suz("Gıda 7890")).toEqual([]);
  });
});

describe("A4 — unvan araması (regresyon)", () => {
  it("Türkçe harf duyarlı küçük/büyük harf eşleşmesi korunur", () => {
    expect(suz("istanbul")).toEqual(["a"]); // "İ" → "i"
    expect(suz("ışık")).toEqual(["a"]); // "I" → "ı"
    expect(suz("ÇELİK")).toEqual(["b"]);
    expect(suz("izmir")).toEqual([]); // "Izmir" → "ızmir" (tr kuralı; önceki davranışla aynı)
    expect(suz("ızmir")).toEqual(["c"]);
  });

  it("alt dize ve ortak ekler; boş sorgu hepsini döndürür", () => {
    expect(suz("a.ş.")).toEqual(["a", "c"]);
    expect(suz("lojist")).toEqual(["c"]);
    expect(suz("")).toEqual(["a", "b", "c", "d"]);
    expect(suz("   ")).toEqual(["a", "b", "c", "d"]);
    expect(suz("olmayan")).toEqual([]);
  });
});

describe("A5 — sekmeye özgü alanlar korunur", () => {
  const isl = { unvan: "Ankara Çelik", vkn: "9876543210" };
  it("sözleşme no ve denetçi adı ek alan olarak eşleşir; VKN de çalışır", () => {
    expect(rotasyonAramaEslesir(rotasyonAramaSorgusu("BD-2026/14"), isl, ["BD-2026/14", "Harun Aktaş"])).toBe(true);
    expect(rotasyonAramaEslesir(rotasyonAramaSorgusu("harun"), isl, ["BD-2026/14", "Harun Aktaş"])).toBe(true);
    expect(rotasyonAramaEslesir(rotasyonAramaSorgusu("3210"), isl, ["Harun Aktaş"])).toBe(true);
    expect(rotasyonAramaEslesir(rotasyonAramaSorgusu("harun"), isl)).toBe(false);
  });
});

describe("A6 — arama + durum filtresi birlikte", () => {
  it("aynı VKN ekine uyan iki işletmeden yalnız durumu eşleşen kalır", () => {
    // a: 7 dönem → azami süre doldu (crit); c: 3 dönem → normal (ok)
    expect(suz("7890", "crit")).toEqual(["a"]);
    expect(suz("7890", "ok")).toEqual(["c"]);
    expect(suz("7890", "brk")).toEqual([]);
  });

  it("unvan araması + durum filtresi", () => {
    expect(suz("a.ş.", "crit")).toEqual(["a"]);
    expect(suz("a.ş.", "all")).toEqual(["a", "c"]);
  });
});
