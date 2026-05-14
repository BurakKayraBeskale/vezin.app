"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import clsx from "clsx";
import { useTheme } from "@/components/ThemeProvider";

interface SidebarProps {
  userName: string;
  userEmail: string;
  userRole: "ADMIN" | "MANAGER" | "EMPLOYEE";
  userDepartment: string;
  overdueCount: number;
  unreadPetitions: number;
  pendingLeave: number;
  unreadNotifications: number;
  isOpen?: boolean;
  onClose?: () => void;
}

const coreNavItems = [
  {
    href: "/",
    label: "Dashboard",
    showOverdue: false,
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/board",
    label: "Tahta",
    showOverdue: false,
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
  },
  {
    href: "/backlog",
    label: "Backlog",
    showOverdue: true,
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
];

const employeeExtraNavItems = [
  {
    href: "/petition",
    label: "Dilekçeler",
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/leave",
    label: "İzin",
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

const adminNavItems = [
  {
    href: "/admin/users",
    label: "Kullanıcılar",
    badgeKey: null as null,
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    href: "/reports",
    label: "Raporlar",
    badgeKey: null as null,
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: "/petition",
    label: "Dilekçeler",
    badgeKey: "unreadPetitions" as const,
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/leave",
    label: "İzin Yönetimi",
    badgeKey: "pendingLeave" as const,
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

interface NavLinkProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  badge?: number;
}

function NavLink({ href, label, icon, active, badge }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-2.5 px-3 rounded-lg text-[13px] font-medium transition-colors h-10 lg:h-9",
        active
          ? "bg-[#F57C28] text-white shadow-md shadow-[#F57C28]/20"
          : "text-white/55 hover:text-white hover:bg-white/6"
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className={clsx(
          "text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0",
          active ? "bg-white/25 text-white" : "bg-red-500 text-white"
        )}>
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {active && !badge && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/50 flex-shrink-0" />
      )}
    </Link>
  );
}

export default function Sidebar({
  userName, userEmail, userRole, userDepartment, overdueCount, unreadPetitions, pendingLeave,
  unreadNotifications, isOpen = false, onClose,
}: SidebarProps) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const adminBadges: Record<string, number> = { unreadPetitions, pendingLeave };

  return (
    <aside
      className={clsx(
        "fixed left-0 top-0 h-screen w-64 lg:w-56 bg-[#17172A] flex flex-col z-50 shadow-xl",
        "transition-transform duration-300 ease-in-out",
        // Mobile: slide in/out; Desktop: always visible
        isOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0"
      )}
    >
      {/* Logo + mobile close */}
      <div style={{ width: "100%", padding: "20px 16px", display: "flex", alignItems: "center" }}>
        <a href="/" style={{ flex: 1, display: "block" }}>
          <img
            src="/logo-white.png?v=2"
            alt="Vezin"
            style={{ width: "100%", height: "auto" }}
          />
        </a>
        {/* Close button — only visible on mobile */}
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
          aria-label="Menüyü kapat"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-1.5 text-[9px] font-semibold text-white/25 uppercase tracking-widest">
          Menü
        </p>
        {coreNavItems.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={pathname === item.href}
            badge={item.showOverdue ? overdueCount : undefined}
          />
        ))}
        {/* Bildirimler — her rol */}
        <NavLink
          href="/notifications"
          label="Bildirimler"
          icon={
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          }
          active={pathname === "/notifications"}
          badge={unreadNotifications}
        />
        {/* Toplantılar — her rol */}
        <NavLink
          href="/meetings"
          label="Toplantılar"
          icon={
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          active={pathname === "/meetings"}
        />

        {(userRole === "ADMIN" || userDepartment === "BAGIMSIZ_DENETIM") && (
          <NavLink
            href="/companies"
            label="Firmalar"
            icon={
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
            active={pathname.startsWith("/companies")}
          />
        )}

        {(userRole === "EMPLOYEE" || userRole === "MANAGER") && employeeExtraNavItems.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={pathname === item.href}
          />
        ))}

        <NavLink
          href="/templates"
          label="Şablonlar"
          icon={
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
          }
          active={pathname === "/templates" || pathname.startsWith("/admin/templates")}
        />

        {userRole === "ADMIN" && (
          <>
            <div className="pt-3 pb-1">
              <p className="px-3 text-[9px] font-semibold text-white/25 uppercase tracking-widest">
                Yönetim
              </p>
            </div>
            {adminNavItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={pathname === item.href}
                badge={item.badgeKey ? adminBadges[item.badgeKey] : undefined}
              />
            ))}
          </>
        )}
      </nav>

      {/* Theme toggle + User + Logout */}
      <div className="px-3 pb-4 lg:pb-3 border-t border-white/10 pt-3 flex-shrink-0 space-y-1">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="w-full flex items-center gap-2.5 px-3 h-10 lg:h-9 rounded-lg text-[13px] font-medium text-white/45 hover:text-white hover:bg-white/5 transition-colors"
          title={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
        >
          {theme === "dark" ? (
            <>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
              <span>Açık Tema</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              <span>Koyu Tema</span>
            </>
          )}
        </button>

        {/* User info — /profile'a link */}
        <Link
          href="/profile"
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-[#F57C28] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            {initials(userName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{userName}</p>
            <p className="text-white/35 text-[10px] truncate">
              {userRole === "ADMIN" ? "Admin" : userRole === "MANAGER" ? "Yönetici" : "Çalışan"}
            </p>
          </div>
        </Link>

        {/* Logout */}
        <button
          onClick={() => signOut({ callbackUrl: "https://vezin.app/login" })}
          className="w-full flex items-center gap-2.5 px-3 h-10 lg:h-9 rounded-lg text-[13px] font-medium text-white/45 hover:text-white hover:bg-white/5 transition-colors"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Çıkış Yap
        </button>
      </div>
    </aside>
  );
}
