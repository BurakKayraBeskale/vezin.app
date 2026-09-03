"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ProjectUser = { id: string; name: string; title?: string | null };

type ProjectEditData = {
  id: string;
  name: string;
  department: string;
  startDate?: string | null;
  notes?: string | null;
  about?: string | null;
};

const DEPT_LABELS: Record<string, string> = {
  BAGIMSIZ_DENETIM: "Bağımsız Denetim",
  VERGI: "Vergi",
};

export default function ProjeEditForm({
  project,
  canEdit,
  currentMemberIds,
}: {
  project: ProjectEditData;
  canEdit: boolean;
  currentMemberIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: project.name,
    startDate: project.startDate
      ? new Date(project.startDate).toISOString().split("T")[0]
      : "",
    notes: project.notes ?? "",
    about: project.about ?? "",
  });
  const [availableUsers, setAvailableUsers] = useState<ProjectUser[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>(currentMemberIds);
  const [loadingUsers, setLoadingUsers] = useState(false);

  if (!canEdit) return null;

  async function fetchUsers() {
    setLoadingUsers(true);
    try {
      const res = await fetch(
        `/api/users/assignable?projectDept=${project.department}`
      );
      if (res.ok) {
        setAvailableUsers(await res.json());
      }
    } finally {
      setLoadingUsers(false);
    }
  }

  function handleOpen() {
    setMemberIds(currentMemberIds);
    setError("");
    setOpen(true);
    fetchUsers();
  }

  function handleClose() {
    setOpen(false);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          startDate: form.startDate || null,
          notes: form.notes || null,
          about: form.about || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Güncelleme başarısız");
        return;
      }

      // Member diff
      const addUserIds = memberIds.filter((id) => !currentMemberIds.includes(id));
      const removeUserIds = currentMemberIds.filter(
        (id) => !memberIds.includes(id)
      );
      if (addUserIds.length > 0 || removeUserIds.length > 0) {
        const mRes = await fetch(`/api/projects/${project.id}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ addUserIds, removeUserIds }),
        });
        if (!mRes.ok) {
          const mData = await mRes.json();
          setError(mData.error || "Üye güncelleme başarısız");
          return;
        }
      }

      handleClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="px-3 py-1.5 bg-[#F57C28] text-white rounded-lg text-sm font-medium hover:bg-[#e06d1f] transition-colors"
      >
        Güncelle
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Projeyi Güncelle
              </h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Birim
                </label>
                <p className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-500 dark:text-gray-400">
                  {DEPT_LABELS[project.department] ?? project.department} —
                  değiştirilemez
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Proje Adı *
                </label>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Başlangıç Tarihi
                </label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notlar
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={3}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hakkında
                </label>
                <textarea
                  value={form.about}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, about: e.target.value }))
                  }
                  rows={3}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                />
              </div>

              {/* Member management */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Üyeler
                </label>
                {loadingUsers ? (
                  <p className="text-xs text-gray-400 py-2">Yükleniyor...</p>
                ) : availableUsers.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                    {availableUsers.map((u) => (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={memberIds.includes(u.id)}
                          onChange={(e) =>
                            setMemberIds((prev) =>
                              e.target.checked
                                ? [...prev, u.id]
                                : prev.filter((id) => id !== u.id)
                            )
                          }
                          className="rounded"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {u.name}
                          </p>
                          {u.title && (
                            <p className="text-[10px] text-gray-500">{u.title}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 py-2">
                    Bu birim için üye bulunamadı
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-[#F57C28] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#e06d1f] disabled:opacity-50 transition-colors"
                >
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
