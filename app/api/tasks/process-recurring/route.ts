import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function nextOccurrenceDate(current: Date, type: string, day: number | null): Date {
  const d = new Date(current);
  switch (type) {
    case "DAILY":
      d.setDate(d.getDate() + 1);
      break;
    case "WEEKLY":
      d.setDate(d.getDate() + 7);
      break;
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1);
      if (day && day >= 1 && day <= 31) d.setDate(day);
      break;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const now = new Date();

  // Find recurring tasks whose nextOccurrence has passed
  const dueTasks = await prisma.task.findMany({
    where: {
      isRecurring: true,
      nextOccurrence: { lte: now },
    },
  });

  const created: string[] = [];

  for (const task of dueTasks) {
    try {
      // Create a new task instance
      const dueDate = task.nextOccurrence
        ? new Date(task.nextOccurrence.getTime() + (task.recurringType === "DAILY" ? 0 : 7 * 24 * 60 * 60 * 1000))
        : null;

      await prisma.task.create({
        data: {
          title: task.title,
          description: task.description,
          priority: task.priority,
          assignedToId: task.assignedToId,
          dueDate,
          createdById: task.createdById,
          status: "TODO",
        },
      });

      // Notify assignee
      if (task.assignedToId) {
        try {
          await prisma.notification.create({
            data: {
              userId: task.assignedToId,
              type: "TASK_ASSIGNED",
              message: `Tekrarlayan görev oluşturuldu: "${task.title}"`,
              relatedId: task.id,
            },
          });
        } catch { /* ignore */ }
      }

      // Update nextOccurrence on the template task
      const next = nextOccurrenceDate(task.nextOccurrence ?? now, task.recurringType ?? "WEEKLY", task.recurringDay);
      await prisma.task.update({
        where: { id: task.id },
        data: { nextOccurrence: next },
      });

      created.push(task.id);
    } catch { /* skip this task */ }
  }

  return NextResponse.json({ processed: created.length, ids: created });
}
