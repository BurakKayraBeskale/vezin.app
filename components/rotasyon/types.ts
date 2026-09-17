export interface RotasyonKadroRecord {
  id: string;
  sozlesmeId: string;
  adSoyad: string;
  unvan: string;
  tip: string; // "ASIL" | "YEDEK"
  fiilenGorevAldi: boolean;
}

export interface RotasyonSozlesmeRecord {
  id: string;
  isletmeId: string;
  sozlesmeNo: string;
  donem: number;
  tur: string;
  not: string | null;
  createdAt: string;
  updatedAt: string;
  kadrolar: RotasyonKadroRecord[];
  isletme?: { id: string; unvan: string; vkn: string };
}

export interface RotasyonIsletmeRecord {
  id: string;
  unvan: string;
  vkn: string;
  oncekiDenetciIlkDonem: number | null;
  oncekiDenetciSonDonem: number | null;
  not: string | null;
  createdAt: string;
  updatedAt: string;
  sozlesmeler: RotasyonSozlesmeRecord[];
}
