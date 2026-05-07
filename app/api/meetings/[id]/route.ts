import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const meeting = await (prisma as any).meeting.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      attendees: {
        include: {
          user: { select: { id: true, name: true, email: true, department: true } },
        },
        orderBy: { user: { name: "asc" } },
      },
    },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Toplantı bulunamadı" }, { status: 404 });
  }

  return NextResponse.json(meeting);
}
