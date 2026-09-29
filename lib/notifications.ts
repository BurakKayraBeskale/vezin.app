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

// ── Proje görev ataması → departman sorumlusu ────────────────────────────────

/**
 * Proje departmanı → proje görev atamalarından haberdar edilecek departman
 * sorumlusu (AÇIK LİSTE — tek yer). overseesDepartment bayrağından TÜRETİLMEZ:
 * Murat Özgür'de de overseesDepartment=YMM var ama bu bildirimi almaz.
 */
export const PROJECT_ASSIGNMENT_SUPERVISOR_EMAILS: Record<string, string> = {
  YMM: "ebubekirozturk@vezin.com.tr",
  BAGIMSIZ_DENETIM: "ahmetoruc@vezin.com.tr",
};

export const PROJECT_TASK_ASSIGNED = "PROJECT_TASK_ASSIGNED";

const BACK_VOWELS = "aıouâ";
const FRONT_VOWELS = "eiöüîû";
const VOICELESS = "fstkçşhp";

/**
 * Özel isme kesme işaretiyle eklenen Türkçe hâl eki (ünlü uyumu + kaynaştırma/sertleşme):
 *   yönelme: Mehmet Demir'e, Ayşe Kaya'ya, Ahmet Oruç'a
 *   ayrılma: Mehmet Demir'den, Ayşe Kaya'dan, Ahmet Oruç'tan
 */
export function trNameSuffix(name: string, kind: "dative" | "ablative"): string {
  const s = name.trim().toLocaleLowerCase("tr");
  const lastVowel = [...s].reverse().find((c) => BACK_VOWELS.includes(c) || FRONT_VOWELS.includes(c));
  const vowel = lastVowel && BACK_VOWELS.includes(lastVowel) ? "a" : "e";
  const last = s.slice(-1);
  const endsWithVowel = last !== "" && (BACK_VOWELS.includes(last) || FRONT_VOWELS.includes(last));
  if (kind === "dative") return `'${endsWithVowel ? "y" : ""}${vowel}`;
  return `'${!endsWithVowel && VOICELESS.includes(last) ? "t" : "d"}${vowel}n`;
}

/**
 * Proje görevi oluşturulduğunda / atananı değiştiğinde projenin departman
 * sorumlusuna bildirim (mevcut atanan/reviewOwner bildirimlerine EK).
 *
 *   - Projesiz görevde üretilmez
 *   - Sorumlu atamayı kendisi yaptıysa gönderilmez
 *   - Sorumlu zaten görevin atananı (yeni ya da önceki) veya reviewOwner'ıysa
 *     gönderilmez — o kişi bu olay için zaten bildirim alıyor (tek bildirim)
 *   - Pasif sorumluya gönderilmez
 *
 * previousAssigneeId verilirse "atananı değiştirdi" metni kullanılır.
 * relatedId = görev → bildirime tıklayınca görev açılır.
 */
export async function notifyProjectSupervisorOfAssignment(opts: {
  projectId: string | null | undefined;
  taskId: string;
  taskTitle: string;
  actorId: string;
  assigneeId: string | null | undefined;
  previousAssigneeId?: string | null;
  reviewOwnerId?: string | null;
}): Promise<void> {
  if (!opts.projectId || !opts.assigneeId) return;
  try {
    const project = await prisma.project.findUnique({
      where: { id: opts.projectId },
      select: { name: true, department: true },
    });
    const supervisorEmail = project ? PROJECT_ASSIGNMENT_SUPERVISOR_EMAILS[project.department] : undefined;
    if (!project || !supervisorEmail) return;

    const supervisor = await prisma.user.findUnique({
      where: { email: supervisorEmail },
      select: { id: true, status: true },
    });
    if (!supervisor || supervisor.status !== "ACTIVE") return;
    const involved = [opts.actorId, opts.assigneeId, opts.previousAssigneeId, opts.reviewOwnerId];
    if (involved.includes(supervisor.id)) return;

    const people = await prisma.user.findMany({
      where: { id: { in: [opts.actorId, opts.assigneeId, opts.previousAssigneeId].filter(Boolean) as string[] } },
      select: { id: true, name: true },
    });
    const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "—";
    const actor = nameOf(opts.actorId);
    const assignee = nameOf(opts.assigneeId);

    const message = opts.previousAssigneeId
      ? `${actor}, '${project.name}' projesindeki '${opts.taskTitle}' görevinin atananını ` +
        `${nameOf(opts.previousAssigneeId)}${trNameSuffix(nameOf(opts.previousAssigneeId), "ablative")} ` +
        `${assignee}${trNameSuffix(assignee, "dative")} değiştirdi.`
      : `${actor}, ${assignee}${trNameSuffix(assignee, "dative")} '${project.name}' projesinde '${opts.taskTitle}' görevini atadı.`;

    await sendNotification(supervisor.id, PROJECT_TASK_ASSIGNED, message, opts.taskId);
  } catch {
    /* ignore — bildirim hataları kritik değil */
  }
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
