import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

function canManage(token: any) {
  return token.role === "ADMIN" || (token.department === "BAGIMSIZ_DENETIM" && token.role === "MANAGER");
}
function canView(token: any) {
  return token.role === "ADMIN" || token.department === "BAGIMSIZ_DENETIM";
}

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
  if (!canView(token)) return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });

  const userId = token.id as string;

  // EMPLOYEE in BAGIMSIZ_DENETIM sees only assigned companies
  let companies;
  if (token.role === "EMPLOYEE" && token.department === "BAGIMSIZ_DENETIM") {
    companies = await prisma.company.findMany({
      where: { assignments: { some: { userId } } },
      include: companyInclude,
      orderBy: { name: "asc" },
    });
  } else {
    companies = await prisma.company.findMany({
      include: companyInclude,
      orderBy: { name: "asc" },
    });
  }

  return NextResponse.json(companies);
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!canManage(token)) return NextResponse.json({ error: "Yetki gerekli" }, { status: 403 });

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

  // Check 5-year rule on creation
  if (company.startDate) {
    await send5YearNotifications(company.id, company.name, company.startDate);
  }

  return NextResponse.json(company, { status: 201 });
}
