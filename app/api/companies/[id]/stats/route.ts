import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

function canView(token: any) {
  return token.role === "ADMIN" || token.department === "BAGIMSIZ_DENETIM";
}

const STATUS_LABELS: Record<string, string> = {
  TODO: "Yapılacak",
  IN_PROGRESS: "Devam Ediyor",
  REVIEW: "İncelemede",
  DONE: "Tamamlandı",
};
const STATUS_COLORS: Record<string, string> = {
  TODO: "#9CA3AF",
  IN_PROGRESS: "#F57C28",
  REVIEW: "#6366F1",
  DONE: "#10B981",
};

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!canView(token)) return NextResponse.json({ error: "Yetki gerekli" }, { status: 403 });

  const tasks = await prisma.task.findMany({
    where: { companyId: params.id },
    select: { status: true, createdAt: true, updatedAt: true },
  });

  // Status distribution
  const statusCount: Record<string, number> = { TODO: 0, IN_PROGRESS: 0, REVIEW: 0, DONE: 0 };
  for (const t of tasks) {
    statusCount[t.status] = (statusCount[t.status] || 0) + 1;
  }
  const statusDist = Object.entries(statusCount).map(([status, count]) => ({
    status,
    label: STATUS_LABELS[status] ?? status,
    count,
    color: STATUS_COLORS[status] ?? "#9CA3AF",
  }));

  // Monthly completed (last 12 months)
  const now = new Date();
  const monthlyMap: Record<string, number> = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap[key] = 0;
  }
  for (const t of tasks.filter((t) => t.status === "DONE")) {
    const d = new Date(t.updatedAt);
    const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in monthlyMap) monthlyMap[key]++;
  }
  const monthlyCompleted = Object.entries(monthlyMap).map(([month, count]) => ({ month, count }));

  // Yearly tasks
  const yearlyMap: Record<number, number> = {};
  for (const t of tasks) {
    const year = new Date(t.createdAt).getFullYear();
    yearlyMap[year] = (yearlyMap[year] || 0) + 1;
  }
  const yearlyTasks = Object.entries(yearlyMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, count]) => ({ year: Number(year), count }));

  return NextResponse.json({ statusDist, monthlyCompleted, yearlyTasks });
}
