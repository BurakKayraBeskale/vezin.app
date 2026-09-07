/**
 * Görev durumu yardımcıları — tek kaynak.
 * Status DONE olduğunda completedAt = şu an; başka duruma geçişte = null.
 */

export function computeCompletedAt(newStatus: string): Date | null {
  return newStatus === "DONE" ? new Date() : null;
}
