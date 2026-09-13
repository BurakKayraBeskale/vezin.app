/**
 * Tekrarlayan görev üretici — D BLOĞU
 *
 * Çalıştırma:
 *   npx tsx scripts/generate-occurrences.ts
 *
 * Cron (sunucuda günde bir kez — örn. sabah 06:00):
 *   0 6 * * * cd /var/www/vezin && npx tsx scripts/generate-occurrences.ts >> /var/log/vezin-recurrence.log 2>&1
 *
 * Kurallar:
 *   - nextOccurrenceAt <= şimdi olan seriler işlenir
 *   - isStopped=true veya bitiş tarihi geçmişse atlanır
 *   - Atanan pasifse VEYA projeye üye değilse: görev OLUŞTURULMAZ, seri sahibine bildirim
 *   - Önceki tekrar tamamlanmamış olsa bile yeni tekrar üretilir
 *   - Her durumda nextOccurrenceAt bir dönem ilerletilir
 *
 * Son tarih bildirimleri (deadline):
 *   - dueDate = yarın olan açık görevler → atanana bildirim
 *   - dueDate = dün olan açık görevler → atanan + reviewOwner
 */

import { PrismaClient } from "@prisma/client";
import { computeNextOccurrence, seriesShouldGenerate } from "../lib/recurring";
import { sendNotification, TaskNotif } from "../lib/notifications";

const prisma = new PrismaClient();

async function generateOccurrences(): Promise<void> {
  const now = new Date();

  const dueSeries = await prisma.recurringSeries.findMany({
    where: {
      isStopped: false,
      nextOccurrenceAt: { lte: now },
    },
  });

  console.log(`[recurrence] ${dueSeries.length} seri işlenecek`);

  for (const series of dueSeries) {
    // Bitiş kontrolü
    if (!seriesShouldGenerate(series)) {
      console.log(`[recurrence] Seri ${series.id} bitti/durdu, atlanıyor`);
      // nextOccurrenceAt'i ilerlet ki tekrar işlenmesin
      await prisma.recurringSeries.update({
        where: { id: series.id },
        data: { isStopped: true },
      });
      continue;
    }

    // Atanan aktif mi?
    const assignee = await prisma.user.findUnique({
      where: { id: series.assignedToId },
      select: { status: true, name: true },
    });

    if (!assignee || assignee.status !== "ACTIVE") {
      console.warn(`[recurrence] Seri ${series.id}: atanan pasif, görev oluşturulmuyor`);
      const notif = TaskNotif.recurringFailed(series.title, "Atanan kullanıcı artık aktif değil", series.id);
      await sendNotification(series.ownerId, notif.type, notif.message, notif.relatedId);
      // nextOccurrenceAt'i yine ilerlet
      await prisma.recurringSeries.update({
        where: { id: series.id },
        data: {
          nextOccurrenceAt: computeNextOccurrence(
            series.nextOccurrenceAt,
            series.recurringType,
            series.recurringDay
          ),
        },
      });
      continue;
    }

    // Projeli görevde üyelik kontrolü
    if (series.projectId) {
      const membership = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: series.projectId, userId: series.assignedToId } },
        select: { projectId: true },
      });
      if (!membership) {
        console.warn(`[recurrence] Seri ${series.id}: atanan proje üyesi değil, görev oluşturulmuyor`);
        const notif = TaskNotif.recurringFailed(
          series.title,
          "Atanan kullanıcı artık proje üyesi değil",
          series.id
        );
        await sendNotification(series.ownerId, notif.type, notif.message, notif.relatedId);
        await prisma.recurringSeries.update({
          where: { id: series.id },
          data: {
            nextOccurrenceAt: computeNextOccurrence(
              series.nextOccurrenceAt,
              series.recurringType,
              series.recurringDay
            ),
          },
        });
        continue;
      }
    }

    // Görev oluştur
    try {
      const task = await prisma.task.create({
        data: {
          title: series.title,
          description: series.description,
          priority: series.priority,
          status: "TODO",
          assignedToId: series.assignedToId,
          reviewOwnerId: series.ownerId,
          createdById: series.ownerId,
          projectId: series.projectId,
          departmentId: series.departmentId,
          isRecurring: true,
          recurringType: series.recurringType,
          recurringDay: series.recurringDay,
          recurringSeriesId: series.id,
          dueDate: null,
        },
      });

      // Atanana bildirim
      await sendNotification(
        series.assignedToId,
        "TASK_ASSIGNED",
        `"${series.title}" tekrarlayan görevi size atandı.`,
        task.id
      );

      console.log(`[recurrence] Görev oluşturuldu: ${task.id} (seri: ${series.id})`);
    } catch (err) {
      console.error(`[recurrence] Görev oluşturulamadı (seri: ${series.id}):`, err);
    }

    // nextOccurrenceAt'i bir dönem ilerlet
    await prisma.recurringSeries.update({
      where: { id: series.id },
      data: {
        nextOccurrenceAt: computeNextOccurrence(
          series.nextOccurrenceAt,
          series.recurringType,
          series.recurringDay
        ),
      },
    });
  }
}

async function sendDeadlineNotifications(): Promise<void> {
  const now = new Date();

  // Yarın = bugünün sonundan sonra, iki gün sonrasından önce
  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  const dueSoonTasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      status: { notIn: ["DONE"] },
      dueDate: { gte: tomorrowStart, lt: tomorrowEnd },
      assignedToId: { not: null },
    },
    select: { id: true, title: true, assignedToId: true },
  });

  for (const task of dueSoonTasks) {
    if (task.assignedToId) {
      const notif = TaskNotif.dueSoon(task.title, task.id);
      await sendNotification(task.assignedToId, notif.type, notif.message, notif.relatedId);
    }
  }
  console.log(`[deadline] ${dueSoonTasks.length} görev için "yarın" bildirimi gönderildi`);

  // Dün geçen (overdue)
  const yesterdayEnd = new Date(now);
  yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
  yesterdayEnd.setHours(23, 59, 59, 999);
  const yesterdayStart = new Date(yesterdayEnd);
  yesterdayStart.setHours(0, 0, 0, 0);

  const overdueTasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      status: { notIn: ["DONE"] },
      dueDate: { gte: yesterdayStart, lte: yesterdayEnd },
      assignedToId: { not: null },
    },
    select: { id: true, title: true, assignedToId: true, reviewOwnerId: true },
  });

  for (const task of overdueTasks) {
    const notif = TaskNotif.overdue(task.title, task.id);
    if (task.assignedToId) {
      await sendNotification(task.assignedToId, notif.type, notif.message, notif.relatedId);
    }
    if (task.reviewOwnerId && task.reviewOwnerId !== task.assignedToId) {
      await sendNotification(task.reviewOwnerId, notif.type, notif.message, notif.relatedId);
    }
  }
  console.log(`[deadline] ${overdueTasks.length} görev için "gecikmiş" bildirimi gönderildi`);
}

async function main() {
  console.log(`[${new Date().toISOString()}] Tekrarlayan görev üretici başlatıldı`);
  try {
    await generateOccurrences();
    await sendDeadlineNotifications();
  } finally {
    await prisma.$disconnect();
  }
  console.log(`[${new Date().toISOString()}] Tamamlandı`);
}

main().catch((err) => {
  console.error("HATA:", err);
  process.exit(1);
});
