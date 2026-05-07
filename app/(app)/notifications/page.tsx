"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

type NotifType = "TASK_ASSIGNED" | "LEAVE_APPROVED" | "LEAVE_REJECTED" | "FEEDBACK_RECEIVED";

interface Notification {
  id: string;
  type: NotifType;
  message: string;
  isRead: boolean;
  relatedId: string | null;
  createdAt: string;
}

const TYPE_CONFIG: Record<NotifType, { icon: string; bg: string; text: string; label: string }> = {
  TASK_ASSIGNED:     { icon: "📋", bg: "var(--badge-orange-bg)",  text: "var(--badge-orange-text)",  label: "Görev Atandı" },
  LEAVE_APPROVED:    { icon: "✅", bg: "var(--badge-emerald-bg)", text: "var(--badge-emerald-text)", label: "İzin Onaylandı" },
  LEAVE_REJECTED:    { icon: "❌", bg: "var(--badge-red-bg)",     text: "var(--badge-red-text)",     label: "İzin Reddedildi" },
  FEEDBACK_RECEIVED: { icon: "💬", bg: "var(--badge-indigo-bg)",  text: "var(--badge-indigo-text)",  label: "Yeni Yorum" },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleString("tr-TR", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        setNotifications(d.notifications ?? []);
        setLoading(false);
        // Sayfa açılınca tümünü okundu işaretle
        if ((d.notifications ?? []).some((n: Notification) => !n.isRead)) {
          fetch("/api/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ markAll: true }),
          });
          setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        }
      });
  }, []);

  async function markAllRead() {
    setMarkingAll(true);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setMarkingAll(false);
  }

  async function markOneRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Bildirimler</h1>
          <p className="text-sm text-gray-400 mt-1">
            {notifications.length} bildirim · {unreadCount} okunmamış
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className="text-xs font-semibold text-[#F57C28] hover:text-[#D96A1A] transition-colors disabled:opacity-50"
          >
            {markingAll ? "İşleniyor..." : "Tümünü okundu işaretle"}
          </button>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-5 py-4 animate-pulse flex items-start gap-3">
                <div className="w-9 h-9 bg-gray-100 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3">🔔</div>
            <p className="text-sm text-gray-400">Henüz bildirim yok</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {notifications.map((n) => {
              const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.TASK_ASSIGNED;
              return (
                <li
                  key={n.id}
                  className={clsx(
                    "flex items-start gap-3 px-5 py-4 transition-colors",
                    !n.isRead ? "bg-orange-50/30" : "hover:bg-gray-50/50"
                  )}
                >
                  {/* Icon */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: cfg.bg }}
                  >
                    {cfg.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: cfg.bg, color: cfg.text }}
                      >
                        {cfg.label}
                      </span>
                      {!n.isRead && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#F57C28] flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-gray-700">{n.message}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{fmtDate(n.createdAt)}</p>
                  </div>

                  {/* Mark read */}
                  {!n.isRead && (
                    <button
                      onClick={() => markOneRead(n.id)}
                      className="flex-shrink-0 text-[11px] text-gray-400 hover:text-[#F57C28] transition-colors py-1 px-2 rounded-lg hover:bg-orange-50 mt-0.5"
                      title="Okundu işaretle"
                    >
                      Okundu
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
