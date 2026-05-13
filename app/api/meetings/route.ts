import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_DEPARTMENTS = [
  "OUTSOURCE", "BAGIMSIZ_DENETIM", "MUHASEBE", "YEMINLI_MALI_MUSAVIR", "ADMIN",
];
const VALID_DURATIONS = [30, 60, 120];

// GET /api/meetings?year=2026&month=5
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));

  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const role = (session.user as any).role as string;
  const department = (session.user as any).department as string;
  const isAdmin = role === "ADMIN";

  const meetings = await (prisma as any).meeting.findMany({
    where: {
      date: { startsWith: prefix },
      ...(isAdmin ? {} : { department }),
    },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });

  // Group by date
  const meetingsByDay: Record<string, typeof meetings> = {};
  for (const m of meetings) {
    if (!meetingsByDay[m.date]) meetingsByDay[m.date] = [];
    meetingsByDay[m.date].push(m);
  }

  return NextResponse.json({ meetingsByDay });
}

// POST /api/meetings — sadece ADMIN ve MANAGER
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const role = (session.user as any).role as string;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Sadece yönetici veya admin toplantı oluşturabilir" }, { status: 403 });
  }

  const createdById = (session.user as any).id as string;
  const sessionDepartment = (session.user as any).department as string | undefined;
  const body = await req.json();

  const { title, description, date, time, duration } = body;
  // MANAGER kendi departmanını kullanır, ADMIN istediği departmanı seçebilir
  const department = role === "MANAGER" ? sessionDepartment : body.department;

  if (!title?.trim() || !date || !time || !department) {
    return NextResponse.json({ error: "Başlık, tarih, saat ve departman zorunlu" }, { status: 400 });
  }

  // Validate date format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Tarih formatı geçersiz (YYYY-MM-DD)" }, { status: 400 });
  }

  // Validate time format HH:MM
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json({ error: "Saat formatı geçersiz (HH:MM)" }, { status: 400 });
  }

  const dur = Number(duration);
  if (!VALID_DURATIONS.includes(dur)) {
    return NextResponse.json({ error: "Geçersiz süre" }, { status: 400 });
  }

  if (!VALID_DEPARTMENTS.includes(department)) {
    return NextResponse.json({ error: "Geçersiz departman" }, { status: 400 });
  }

  // Create meeting
  const meeting = await (prisma as any).meeting.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      date,
      time,
      duration: dur,
      department,
      createdById,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  // Find all users in the department to notify
  const deptUsers = await prisma.user.findMany({
    where: { department },
    select: { id: true },
  });

  const notifMessage = `YENİ TOPLANTI: ${meeting.title} - ${date} ${time}`;

  // Create attendees + notifications in parallel
  await Promise.all([
    // Bulk create attendees
    (prisma as any).meetingAttendee.createMany({
      data: deptUsers.map((u: { id: string }) => ({
        meetingId: meeting.id,
        userId: u.id,
        status: "PENDING",
      })),
      skipDuplicates: true,
    }),
    // Bulk create notifications
    prisma.notification.createMany({
      data: deptUsers.map((u: { id: string }) => ({
        userId: u.id,
        type: "MEETING_CREATED",
        message: notifMessage,
        relatedId: meeting.id,
      })),
    }),
  ]);

  return NextResponse.json(meeting, { status: 201 });
}
