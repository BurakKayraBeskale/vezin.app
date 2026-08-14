import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { canAccessCompanies } from "@/lib/access";

const companyInclude = {
  assignments: {
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { assignedAt: "asc" as const },
  },
};

async function send5YearNotifications(companyId: string, companyName: string, startDate: Date) {
  const yearsWorking = (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (yearsWorking < 5) return;

  const assignments = await prisma.companyAssignment.findMany({
    where: { companyId },
    select: { userId: true },
  });
  for (const a of assignments) {
    try {
      await prisma.notification.create({
        data: {
          userId: a.userId,
          type: "COMPANY_5_YEARS",
          message: `Bu firmayla 5 yıldan fazla süredir çalışıyorsunuz: ${companyName}`,
          relatedId: companyId,
        },
      });
    } catch { /* ignore */ }
  }
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const mode = req.nextUrl.searchParams.get("mode");

  // ?mode=options: kimliği doğrulanmış herkese açık — yalnızca { id, name }
  if (mode === "options") {
    const companies = await prisma.company.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(companies);
  }

  // Tam detay: yalnızca ADMIN veya canManageCompanies
  if (!canAccessCompanies(token as any)) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const companies = await prisma.company.findMany({
    include: companyInclude,
    orderBy: { name: "asc" },
  });
  return NextResponse.json(companies);
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!canAccessCompanies(token as any)) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const body = await req.json();
  const { name, taxNumber, sector, startDate, notes, about } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Firma adı zorunlu" }, { status: 400 });

  const company = await prisma.company.create({
    data: {
      name: name.trim(),
      taxNumber: taxNumber?.trim() || null,
      sector: sector?.trim() || null,
      startDate: startDate ? new Date(startDate) : null,
      notes: notes?.trim() || null,
      about: about?.trim() || null,
    },
    include: companyInclude,
  });

  if (company.startDate) {
    await send5YearNotifications(company.id, company.name, company.startDate);
  }

  return NextResponse.json(company, { status: 201 });
}
