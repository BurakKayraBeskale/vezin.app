import type { IzinBakiyesi } from "@/lib/leave";

export interface LeaveAttachmentRecord {
  id: string;
  name: string;
  size: number | null;
  createdAt: string;
  uploadedBy: { id: string; name: string };
}

export interface LeaveRequestRecord {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  days: number;
  type: string;
  note: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; department: string };
  attachments: LeaveAttachmentRecord[];
}

/** Bakiye alanları (toplamHakEdilenGun, devir/uygulama/toplam kullanılan, kalanGun) IzinBakiyesi'nden gelir. */
export interface TeamMemberSummary extends IzinBakiyesi {
  id: string;
  name: string;
  department: string;
  hireDate: string | null;
  hizmetYili: number | null;
  hizmetSuresiMetni: string;
  mesaj: string | null;
}

export interface LeaveBreakdown extends IzinBakiyesi {
  user: { id: string; name: string; department: string; hireDate: string | null };
  year: number;
  hizmetYili: number | null;
  hizmetSuresiMetni: string;
  mesaj: string | null;
  requests: LeaveRequestRecord[];
}
