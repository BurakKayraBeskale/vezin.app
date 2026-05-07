"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Sidebar from "@/components/Sidebar";
import clsx from "clsx";

interface AppShellProps {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
  userRole: "ADMIN" | "MANAGER" | "EMPLOYEE";
  overdueCount: number;
  unreadPetitions: number;
  pendingLeave: number;
  unreadNotifications: number;
}

const STORAGE_KEY = "backlogSeenOverdue";

export default function AppShell({
  children,
  userName,
  userEmail,
  userRole,
  overdueCount: initOverdue,
  unreadPetitions: initPetitions,
  pendingLeave: initLeave,
  unreadNotifications: initNotifications,
}: AppShellProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const [badges, setBadges] = useState({
    overdueCount: initOverdue,
    unreadPetitions: initPetitions,
    pendingLeave: initLeave,
    unreadNotifications: initNotifications,
  });

  // seenOverdue: overdue count at the time the user last visited /backlog.
  // The backlog badge shows the difference (new overdue tasks since last visit).
  const [seenOverdue, setSeenOverdue] = useState(initOverdue);

  // Read seenOverdue from localStorage after hydration
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setSeenOverdue(parseInt(stored, 10));
    } else {
      // First ever visit: treat current count as "seen" so badge starts at 0
      localStorage.setItem(STORAGE_KEY, String(initOverdue));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Re-fetch badges + handle mark-as-read on every route change
  useEffect(() => {
    // 1. Immediately zero out badges for the page being visited
    if (pathname === "/petition" && userRole === "ADMIN") {
      setBadges((b) => ({ ...b, unreadPetitions: 0 }));
      fetch("/api/petitions/read-all", { method: "PATCH" });
    }

    if (pathname === "/notifications") {
      setBadges((b) => ({ ...b, unreadNotifications: 0 }));
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
    }

    // 2. Fetch fresh counts from server
    fetch("/api/badges")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;

        setBadges({
          overdueCount: data.overdueCount,
          // Keep 0 for pages we just marked as read
          unreadPetitions:
            pathname === "/petition" ? 0 : data.unreadPetitions,
          pendingLeave: data.pendingLeave,
          unreadNotifications:
            pathname === "/notifications" ? 0 : data.unreadNotifications,
        });

        // 3. Backlog: update seenOverdue when on backlog page so badge resets
        if (pathname === "/backlog") {
          setSeenOverdue(data.overdueCount);
          localStorage.setItem(STORAGE_KEY, String(data.overdueCount));
        }
      });
  }, [pathname, userRole]);

  // Backlog badge = overdue tasks added since the user last visited /backlog
  const backlogBadge = Math.max(0, badges.overdueCount - seenOverdue);

  return (
    <div className="min-h-screen">
      {/* ── Mobile top navigation bar ─────────────────────── */}
      <header className="lg:hidden fixed top-0 inset-x-0 h-14 bg-[#17172A] z-40 flex items-center px-4 gap-3 shadow-xl">
        <button
          onClick={() => setOpen(true)}
          className="p-2 -ml-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Menüyü aç"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#F57C28] rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
            <Image
              src="/logo.png"
              alt="Vezin"
              width={28}
              height={28}
              className="object-contain"
              onError={(e) => {
                const t = e.target as HTMLImageElement;
                t.style.display = "none";
                if (t.parentElement) {
                  t.parentElement.innerHTML =
                    '<span style="color:white;font-weight:900;font-size:14px">V</span>';
                }
              }}
            />
          </div>
          <span className="text-white font-bold text-sm">Vezin</span>
        </div>
      </header>

      {/* ── Mobile overlay ────────────────────────────────── */}
      <div
        className={clsx(
          "lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setOpen(false)}
      />

      {/* ── Sidebar ───────────────────────────────────────── */}
      <Sidebar
        userName={userName}
        userEmail={userEmail}
        userRole={userRole}
        overdueCount={backlogBadge}
        unreadPetitions={badges.unreadPetitions}
        pendingLeave={badges.pendingLeave}
        unreadNotifications={badges.unreadNotifications}
        isOpen={open}
        onClose={() => setOpen(false)}
      />

      {/* ── Main content ──────────────────────────────────── */}
      <main
        className={clsx(
          "min-h-screen lg:ml-56",
          "pt-14 lg:pt-0",
          "p-4 sm:p-5 lg:p-6",
          "bg-[#F8F9FB] dark:bg-[#0B0B17]",
          "overflow-x-hidden transition-colors duration-200"
        )}
      >
        {children}
      </main>
    </div>
  );
}
