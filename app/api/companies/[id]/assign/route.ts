import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

function canManage(token: any) {
  return token.role === "ADMIN" || (token.department === "BAGIMSIZ_DENETIM" && token.role === "MANAGER");
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!canManage(token)) return NextResponse.json({ error: "Yetki gerekli" }, { status: 403 });

  const { userId, remove } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId gerekli" }, { status: 400 });

  if (remove) {
    await prisma.companyAssignment.deleteMany({
      where: { companyId: params.id, userId },
    });
  } else {
    await prisma.companyAssignment.upsert({
      where: { companyId_userId: { companyId: params.id, userId } },
      create: { companyId: params.id, userId, assignedBy: token.id as string },
      update: {},
    });

    // Notify assigned user
    const company = await prisma.company.findUnique({
      where: { id: params.id },
      select: { name: true, startDate: true },
    });
    if (company) {
      try {
        await prisma.notification.create({
          data: {
            userId,
            type: "TASK_ASSIGNED",
            message: `"${company.name}" firmasına atandınız.`,
            relatedId: params.id,
          },
        });
      } catch { /* ignore */ }

      // 5-year notification on assignment
      if (company.startDate) {
        const yearsWorking = (Date.now() - company.startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (yearsWorking >= 5) {
          try {
            await prisma.notification.create({
              data: {
                userId,
                type: "COMPANY_5_YEARS",
                message: `Bu firmayla 5 yıldan fazla süredir çalışılıyor: ${company.name}`,
                relatedId: params.id,
              },
            });
          } catch { /* ignore */ }
        }
      }
    }
  }

  const updated = await prisma.company.findUnique({
    where: { id: params.id },
    include: {
      assignments: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { assignedAt: "asc" },
      },
    },
  });
  return NextResponse.json(updated);
}
