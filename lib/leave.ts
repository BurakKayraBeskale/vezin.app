/**
 * İzin Yönetimi — saf hesaplama fonksiyonları (UI'dan ve Prisma'dan bağımsız).
 *
 * Bu turda bakiye DÜŞÜMÜ yapılmaz: hak edilen gün ve kullanılan gün yalnızca
 * BİLGİ amaçlı gösterilir; onay bakiyeyi otomatik düşmez, bakiye yetersizse
 * talep engellenmez. LeaveBalance tablosuna hiçbir yerde yazılmaz.
 *
 * Bakiye modeli BİRİKMİŞTİR (firma Excel'iyle aynı):
 *   toplam hak edilen = tamamlanan her hizmet yılının hakkının toplamı
 *   kullanılan        = devir (User.carryUsedDays) + uygulamadaki onaylı yıllık izinler
 *   kalan             = toplam hak edilen − kullanılan (eksi çıkabilir)
 */

// ── İzin türü / durumu ───────────────────────────────────────────────────────

export const LEAVE_TYPES = ["ANNUAL", "EXCUSE", "SICK", "UNPAID", "PARENTAL"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  ANNUAL:   "Yıllık İzin",
  EXCUSE:   "Mazeret İzni",
  SICK:     "Hastalık İzni",
  UNPAID:   "Ücretsiz İzin",
  PARENTAL: "Doğum-Babalık İzni",
};

export const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  PENDING:   "Bekliyor",
  APPROVED:  "Onaylandı",
  REJECTED:  "Reddedildi",
  CANCELLED: "İptal Edildi",
};

export function isValidLeaveType(v: string): v is LeaveType {
  return (LEAVE_TYPES as readonly string[]).includes(v);
}

/**
 * LeaveRequest sorgularında ortak `include` şekli — API uçları arasında tek
 * doğru kaynak (Prisma client'ı burada import ETMEZ, yalnızca düz obje
 * literaldir; route.ts dosyalarının yalnızca route handler export etmesi
 * gereken Next.js kısıtı nedeniyle route dosyasında tutulamaz).
 */
export const leaveInclude = {
  user: { select: { id: true, name: true, email: true, department: true } },
  attachments: {
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
};

// ── İş günü hesabı ───────────────────────────────────────────────────────────

/**
 * Başlangıç-bitiş arasındaki (her iki uç dahil) iş günü sayısı — Cumartesi/
 * Pazar hariç. Talep oluşturma / gün sayısı önizlemesi tek doğru kaynak.
 */
export function isGunuSayisi(startDate: Date, endDate: Date): number {
  let days = 0;
  const cur = new Date(startDate);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    const dow = cur.getDay(); // 0=Pazar, 6=Cumartesi
    if (dow !== 0 && dow !== 6) days++;
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// ── İzin hakkı hesabı — İş Kanunu md. 53 ────────────────────────────────────

export interface IzinHakkiSonuc {
  /** Tamamlanmış hizmet yılı sayısı. hireDate yoksa null. */
  hizmetYili: number | null;
  /** Yıllık izin hak edilen gün sayısı. hireDate yoksa null. */
  hakEdilenGun: number | null;
  /** hireDate yoksa kullanıcıya gösterilecek mesaj. */
  mesaj: string | null;
}

/** İki tarih arasındaki TAMAMLANMIŞ (tam) yıl sayısı — ay/gün karşılaştırmalı. */
function tamamlanmisYil(from: Date, to: Date): number {
  let yil = to.getFullYear() - from.getFullYear();
  const fromMonthDay = from.getMonth() * 100 + from.getDate();
  const toMonthDay = to.getMonth() * 100 + to.getDate();
  if (toMonthDay < fromMonthDay) yil--;
  return Math.max(0, yil);
}

/**
 * Yıllık izin hakkı — 4857 sayılı İş Kanunu madde 53:
 *   1 yıldan az            → 0 gün (hak doğmamış)
 *   1 – 5 yıl (5 dahil)    → 14 gün
 *   5 yıldan fazla – 15 yıldan az → 20 gün
 *   15 yıl (dahil) ve fazlası     → 26 gün
 *
 * hireDate null ise hesap yapılmaz, açıklayıcı mesaj döner.
 */
export function hesaplaIzinHakki(hireDate: Date | null, simdi: Date = new Date()): IzinHakkiSonuc {
  if (!hireDate) {
    return { hizmetYili: null, hakEdilenGun: null, mesaj: "İşe giriş tarihi girilmemiş" };
  }
  const hizmetYili = tamamlanmisYil(hireDate, simdi);
  let hakEdilenGun: number;
  if (hizmetYili < 1) hakEdilenGun = 0;
  else if (hizmetYili <= 5) hakEdilenGun = 14;
  else if (hizmetYili < 15) hakEdilenGun = 20;
  else hakEdilenGun = 26;
  return { hizmetYili, hakEdilenGun, mesaj: null };
}

// ── Birikmiş hak + devir bakiyesi ──────────────────────────────────────────

/**
 * n. hizmet yılı tamamlandığında doğan hak (birikmiş hesap için):
 *   1–5. yıl → 14 gün, 6–15. yıl → 20 gün, 16. yıl ve üzeri → 26 gün.
 */
function yilBasinaHak(n: number): number {
  if (n <= 5) return 14;
  if (n <= 15) return 20;
  return 26;
}

/**
 * İşe girişten bugüne BİRİKMİŞ toplam yıllık izin hakkı. Hak yıldönümünde
 * doğar; tamamlanmamış yıl sayılmaz. Tamamlanan yıl sayısı hesaplaIzinHakki
 * üzerinden alınır. hireDate null ise hesap yapılmaz → null.
 *   ör. 9 yıl → 5×14 + 4×20 = 150, 13 yıl → 5×14 + 8×20 = 230, 4 yıl → 56.
 */
export function toplamHakEdilenIzin(hireDate: Date | null, simdi: Date = new Date()): number | null {
  const { hizmetYili } = hesaplaIzinHakki(hireDate, simdi);
  if (hizmetYili === null) return null;
  let toplam = 0;
  for (let n = 1; n <= hizmetYili; n++) toplam += yilBasinaHak(n);
  return toplam;
}

/**
 * "Uygulama üzerinden kullanılan" gün sayımına giren talepler — onaylanmış,
 * iptal edilmemiş (soft delete) YILLIK izinler. Tüm yıllar dahil (birikmiş
 * model). leaveInclude gibi düz obje literali; Prisma client import edilmez.
 */
export const kullanilanIzinWhere = {
  status: "APPROVED",
  type: "ANNUAL",
  deletedAt: null,
};

export interface IzinBakiyesi {
  /** Birikmiş toplam hak. hireDate yoksa null. */
  toplamHakEdilenGun: number | null;
  /** Uygulama öncesi kullanım (User.carryUsedDays). */
  devirKullanilanGun: number;
  /** Uygulamada onaylanmış yıllık izinlerin toplamı. */
  uygulamaKullanilanGun: number;
  /** devir + uygulama. */
  kullanilanGun: number;
  /** toplam − kullanılan; eksi olabilir. hireDate yoksa null. */
  kalanGun: number | null;
}

/** Gün sayısını gösterim için biçimler — yarım günler "44,5 gün" olarak. */
export function gunMetni(gun: number): string {
  return `${gun.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} gün`;
}

export function izinBakiyesi(
  hireDate: Date | null,
  carryUsedDays: number,
  uygulamaKullanilanGun: number,
  simdi: Date = new Date()
): IzinBakiyesi {
  const toplamHakEdilenGun = toplamHakEdilenIzin(hireDate, simdi);
  const kullanilanGun = carryUsedDays + uygulamaKullanilanGun;
  return {
    toplamHakEdilenGun,
    devirKullanilanGun: carryUsedDays,
    uygulamaKullanilanGun,
    kullanilanGun,
    kalanGun: toplamHakEdilenGun !== null ? toplamHakEdilenGun - kullanilanGun : null,
  };
}

// ── Hizmet süresi — GÖSTERİM amaçlı yıl/ay/gün ayrıntısı ────────────────────
//    (İzin hakkı hesabını ETKİLEMEZ — hesaplaIzinHakki yukarıda hâlâ tam yıl
//    üzerinden çalışır. Bu yalnızca "6 ay 1 gün" gibi okunur metin üretir.)

interface HizmetSuresiDetay {
  yil: number;
  ay: number;
  gun: number;
}

/** İki tarih arasındaki yıl/ay/gün farkı — takvim ayı uzunluklarına göre. */
function hizmetSuresiDetay(from: Date, to: Date): HizmetSuresiDetay {
  let yil = to.getFullYear() - from.getFullYear();
  let ay = to.getMonth() - from.getMonth();
  let gun = to.getDate() - from.getDate();

  if (gun < 0) {
    ay -= 1;
    // `to` ayından bir önceki ayın son günü
    const oncekiAy = new Date(to.getFullYear(), to.getMonth(), 0);
    gun += oncekiAy.getDate();
  }
  if (ay < 0) {
    yil -= 1;
    ay += 12;
  }
  return { yil: Math.max(0, yil), ay: Math.max(0, ay), gun: Math.max(0, gun) };
}

/**
 * Hizmet süresini "2 yıl 3 ay 12 gün" biçiminde okunur metne çevirir.
 * Sıfır olan birimler atlanır. 1 günden az ise "Bugün başladı".
 * hireDate null ise hesaplaIzinHakki ile aynı mesaj döner.
 */
export function hizmetSuresiMetni(hireDate: Date | null, simdi: Date = new Date()): string {
  if (!hireDate) return "İşe giriş tarihi girilmemiş";
  const { yil, ay, gun } = hizmetSuresiDetay(hireDate, simdi);
  const parcalar: string[] = [];
  if (yil > 0) parcalar.push(`${yil} yıl`);
  if (ay > 0) parcalar.push(`${ay} ay`);
  if (gun > 0) parcalar.push(`${gun} gün`);
  if (parcalar.length === 0) return "Bugün başladı";
  return parcalar.join(" ");
}
