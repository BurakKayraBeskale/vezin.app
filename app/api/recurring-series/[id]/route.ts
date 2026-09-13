/**
 * Tekrarlayan seri yönetimi — D BLOĞU
 *
 * PATCH /api/recurring-series/[id]
 *   action: "stop"  → seriyi durdurur (geçmiş görevler etkilenmez)
 *   action: "edit"  → yalnızca gelecekte üretilecek görevleri etkiler
 *                    (title, description, priority, assignedToId, endType, endDate, recurringDay)
 *
 * Yetki: seri sahibi (ownerId) veya ADMIN / canViewAllProjects
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

async function getSession(req: NextRequest) {
  return getToken({ req, secret: process.env.NEXTAUTH_SECRET });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getSession(req);
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const series = await prisma.recurringSeries.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      tasks: {
        where: { deletedAt: null },
        select: { id: true, title: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!series) return NextResponse.json({ error: "Seri bulunamadı" }, { status: 404 });
  return NextResponse.json(series);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getSession(req);
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const userId = token.id as string;
  const userRole = (token as any).role as string;
  const canViewAllProjects = (token as any).canViewAllProjects as boolean ?? false;
  const isManager = userRole === "ADMIN" || canViewAllProjects;

  const series = await prisma.recurringSeries.findUnique({
    where: { id: params.id },
  });
  if (!series) return NextResponse.json({ error: "Seri bulunamadı" }, { status: 404 });

  // Yetki: seri sahibi veya yönetici
  if (series.ownerId !== userId && !isManager) {
    return NextResponse.json({ error: "Bu seri üzerinde yetkiniz yok" }, { status: 403 });
  }

  const body = await req.json();

  if (body.action === "stop") {
    // Seriyi durdur — geçmiş görevler SİLİNMEZ, yalnızca yeni üretim durur
    const updated = await prisma.recurringSeries.update({
      where: { id: params.id },
      data: { isStopped: true },
    });
    return NextResponse.json(updated);
  }

  if (body.action === "edit") {
    // Yalnızca gelecekte üretilecek görevler etkilenir (şablon güncellenir)
    // Geçmiş görev kayıtları hiç dokunulmaz
    const data: Record<string, unknown> = {};
    if (body.title?.trim()) data.title = body.title.trim();
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.priority) data.priority = body.priority;
    if (body.assignedToId) data.assignedToId = body.assignedToId;
    if (body.endType) data.endType = body.endType;
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.recurringDay !== undefined) data.recurringDay = body.recurringDay ?? null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
    }

    const updated = await prisma.recurringSeries.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Geçersiz aksiyon" }, { status: 400 });
}
