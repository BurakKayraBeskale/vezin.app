/**
 * Bildirim gönderme yardımcıları — D BLOĞU
 *
 * SPAM önleme kuralı: bildirim yalnızca olayla DOĞRUDAN ilişkili kişilere gider.
 * Senior Manager / Partner departmanlarının tüm görevleri görmesi bildirim hakkı doğurmaz.
 * Pasif kullanıcılara bildirim gönderilmez.
 */

import { prisma } from "@/lib/prisma";

/**
 * Tek bir kullanıcıya bildirim gönder.
 * Pasif / silinmiş kullanıcılar otomatik atlanır.
 */
export async function sendNotification(
  userId: string,
  type: string,
  message: string,
  relatedId?: string
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (!user || user.status !== "ACTIVE") return;
    await prisma.notification.create({
      data: { userId, type, message, relatedId },
    });
  } catch {
    /* ignore — bildirim hataları kritik değil */
  }
}

/**
 * Birden fazla farklı kullanıcıya aynı bildirimi gönder.
 * Tekrar eden ID'ler ve boş değerler otomatik filtrelenir.
 */
export async function sendNotificationToMany(
  userIds: (string | null | undefined)[],
  type: string,
  message: string,
  relatedId?: string
): Promise<void> {
  const unique = [...new Set(userIds.filter(Boolean) as string[])];
  await Promise.all(unique.map((id) => sendNotification(id, type, message, relatedId)));
}

/**
 * Görev olaylarına göre önceden tanımlanmış bildirim şablonları.
 */
export const TaskNotif = {
  /** Yeni görev atandı → atanan */
  taskAssigned: (taskTitle: string, taskId: string) =>
    ({ type: "TASK_ASSIGNED", message: `"${taskTitle}" görevi size atandı.`, relatedId: taskId }),

  /** Atanan değişti → eski atanan */
  taskTaken: (taskTitle: string, taskId: string) =>
    ({ type: "TASK_ASSIGNED", message: `"${taskTitle}" görevi artık size atanmıyor.`, relatedId: taskId }),

  /** İncelemeye gönderildi → reviewOwner */
  submittedForReview: (taskTitle: string, taskId: string) =>
    ({ type: "TASK_ASSIGNED", message: `"${taskTitle}" görevi incelemenizi bekliyor.`, relatedId: taskId }),

  /** Revizyon istendi → atanan */
  revisionRequested: (taskTitle: string, taskId: string) =>
    ({ type: "TASK_ASSIGNED", message: `"${taskTitle}" görevi için revizyon istendi.`, relatedId: taskId }),

  /** Görev yeniden açıldı → atanan */
  taskReopened: (taskTitle: string, taskId: string) =>
    ({ type: "TASK_ASSIGNED", message: `"${taskTitle}" görevi yeniden açıldı.`, relatedId: taskId }),

  /** reviewOwner değişti → yeni reviewOwner */
  reviewOwnerChanged: (taskTitle: string, taskId: string) =>
    ({ type: "TASK_ASSIGNED", message: `"${taskTitle}" görevinin incelemesi size devredildi.`, relatedId: taskId }),

  /** reviewOwner devredildi → eski reviewOwner */
  reviewOwnerLost: (taskTitle: string, taskId: string) =>
    ({ type: "TASK_ASSIGNED", message: `"${taskTitle}" görevinin incelemesi başka kullanıcıya devredildi.`, relatedId: taskId }),

  /** Alt görev tamamlandı → parent atananı */
  subtaskCompleted: (subtaskTitle: string, parentId: string) =>
    ({ type: "TASK_ASSIGNED", message: `"${subtaskTitle}" alt görevi tamamlandı.`, relatedId: parentId }),

  /** Tüm alt görevler tamamlandı → parent atananı */
  allSubtasksDone: (parentTitle: string, parentId: string) =>
    ({ type: "TASK_ASSIGNED", message: `"${parentTitle}" görevine bağlı tüm alt görevler tamamlandı. Ana görevi incelemeye gönderebilirsiniz.`, relatedId: parentId }),

  /** Son tarihe 1 gün kala → atanan */
  dueSoon: (taskTitle: string, taskId: string) =>
    ({ type: "TASK_ASSIGNED", message: `"${taskTitle}" görevinin son tarihi yarın.`, relatedId: taskId }),

  /** Son tarih geçti → atanan + reviewOwner */
  overdue: (taskTitle: string, taskId: string) =>
    ({ type: "TASK_ASSIGNED", message: `"${taskTitle}" görevinin son tarihi geçti.`, relatedId: taskId }),

  /** Tekrarlayan görev oluşturulamadı → seri sahibi */
  recurringFailed: (taskTitle: string, reason: string, seriesId: string) =>
    ({ type: "TASK_ASSIGNED", message: `Tekrarlayan görev oluşturulamadı: "${taskTitle}" — ${reason}`, relatedId: seriesId }),
};
