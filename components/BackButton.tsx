"use client";

import { useRouter, usePathname } from "next/navigation";

export default function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === "/" || pathname === "/login") return null;

  const handleClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Geri dön"
      className="inline-flex items-center gap-1.5 min-h-[40px] px-2 rounded-lg text-sm font-medium text-[#F57C28] hover:text-[#D96A1A] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F57C28] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B0B17]"
    >
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Geri
    </button>
  );
}
