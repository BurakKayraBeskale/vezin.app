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

export interface TeamMemberSummary {
  id: string;
  name: string;
  department: string;
  hireDate: string | null;
  hizmetYili: number | null;
  hakEdilenGun: number | null;
  mesaj: string | null;
  kullanilanGun: number;
  kalanGun: number | null;
}

export interface LeaveBreakdown {
  user: { id: string; name: string; department: string; hireDate: string | null };
  year: number;
  hizmetYili: number | null;
  hakEdilenGun: number | null;
  mesaj: string | null;
  kullanilanGun: number;
  kalanGun: number | null;
  requests: LeaveRequestRecord[];
}
