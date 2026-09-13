import { prisma } from "@/lib/prisma";
import { computeNextOccurrence, seriesShouldGenerate } from "@/lib/recurring";
import { sendNotification, TaskNotif } from "@/lib/notifications";

export async function generateOccurrencesForSeries(seriesId: string): Promise<string | null> {
  const series = await prisma.recurringSeries.findUnique({ where: { id: seriesId } });
  if (!series) return null;
  if (!seriesShouldGenerate(series)) return null;

  const assignee = await prisma.user.findUnique({
    where: { id: series.assignedToId },
    select: { status: true },
  });

  if (!assignee || assignee.status !== "ACTIVE") {
    const notif = TaskNotif.recurringFailed(series.title, "Atanan kullanıcı artık aktif değil", series.id);
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
    return null;
  }

  if (series.projectId) {
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId: series.projectId, userId: series.assignedToId },
      },
      select: { projectId: true },
    });
    if (!membership) {
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
      return null;
    }
  }

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
    },
  });

  await sendNotification(
    series.assignedToId,
    "TASK_ASSIGNED",
    `"${series.title}" tekrarlayan görevi size atandı.`,
    task.id
  );

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

  return task.id;
}
