"use client";

import { useEffect, useState } from "react";
import { TaskFull } from "./TaskModal";

interface AssignableUser {
  id: string;
  name: string;
  email: string;
  title: string | null;
  seniorityLevel: number;
}

interface Props {
  taskId: string;
  projectId?: string | null;
  departmentId?: string | null;
  currentAssigneeId?: string | null;
  onClose: () => void;
  onSubmitted: (task: TaskFull) => void;
}

export default function ReassignModal({
  taskId,
  projectId,
  departmentId,
  currentAssigneeId,
  onClose,
  onSubmitted,
}: Props) {
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setUsersLoading(true);
    const params = new URLSearchParams();
    if (projectId) params.set("projectId", projectId);
    else if (departmentId) params.set("departmentId", departmentId);
    fetch(`/api/users/assignable?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: AssignableUser[]) => {
        if (Array.isArray(data)) setUsers(data);
      })
      .catch(() => {})
      .finally(() => setUsersLoading(false));
  }, [projectId, departmentId]);

  async function handleSubmit() {
    if (!selected) {
      setError("Bir kişi seçin");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Atama değiştirilemedi");
        return;
      }
      onSubmitted(data);
    } catch {
      setError("Sunucu hatası");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-base font-bold text-gray-900 mb-3">Atanan Kişiyi Değiştir</h3>

        {usersLoading ? (
          <div className="text-sm text-gray-400 py-4 text-center">Yükleniyor...</div>
        ) : (
          <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
            {users.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">Atanabilir kişi bulunamadı</div>
            )}
            {users.map((u) => (
              <label
                key={u.id}
                className={`flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 cursor-pointer ${
                  u.id === currentAssigneeId ? "opacity-50" : ""
                }`}
              >
                <input
                  type="radio"
                  name="reassign"
                  checked={selected === u.id}
                  onChange={() => setSelected(u.id)}
                  disabled={u.id === currentAssigneeId}
                  className="w-3.5 h-3.5 accent-[#F57C28] flex-shrink-0"
                />
                <div className="w-6 h-6 rounded-full bg-[#F57C28] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                  {u.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-700 truncate">
                    {u.name}
                    {u.id === currentAssigneeId && (
                      <span className="text-xs text-gray-400"> (mevcut)</span>
                    )}
                  </p>
                  {u.title && <p className="text-[10px] text-gray-400 truncate">{u.title}</p>}
                </div>
              </label>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">
            {error}
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !selected}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#F57C28] hover:bg-[#D96A1A] disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-md shadow-[#F57C28]/25"
          >
            {loading ? "..." : "Ata"}
          </button>
        </div>
      </div>
    </div>
  );
}
