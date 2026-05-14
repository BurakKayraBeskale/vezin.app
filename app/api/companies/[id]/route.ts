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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!canView(token)) return NextResponse.json({ error: "Yetki gerekli" }, { status: 403 });

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: companyInclude,
  });
  if (!company) return NextResponse.json({ error: "Firma bulunamadı" }, { status: 404 });

  // Employee: only see assigned
  if (token.role === "EMPLOYEE" && token.department === "BAGIMSIZ_DENETIM") {
    const isAssigned = company.assignments.some((a) => a.userId === (token.id as string));
    if (!isAssigned) return NextResponse.json({ error: "Erişim yok" }, { status: 403 });
  }

  return NextResponse.json(company);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!canManage(token)) return NextResponse.json({ error: "Yetki gerekli" }, { status: 403 });

  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.taxNumber !== undefined) data.taxNumber = body.taxNumber ? String(body.taxNumber).trim() || null : null;
    if (body.sector !== undefined) data.sector = body.sector ? String(body.sector).trim() || null : null;
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() || null : null;
    if (body.about !== undefined) data.about = body.about ? String(body.about).trim() || null : null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
    }

    const company = await prisma.company.update({
      where: { id: params.id },
      data,
      include: companyInclude,
    });

    // Re-check 5-year rule on update
    if (company.startDate) {
      await send5YearNotifications(company.id, company.name, company.startDate);
    }

    return NextResponse.json(company);
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Firma bulunamadı" }, { status: 404 });
    }
    console.error("PATCH /api/companies/[id]:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!canManage(token)) return NextResponse.json({ error: "Yetki gerekli" }, { status: 403 });

  await prisma.company.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
