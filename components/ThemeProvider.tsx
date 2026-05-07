"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeCtx>({ theme: "light", toggle: () => {} });

function applyTheme(t: Theme) {
  const isDark = t === "dark";
  const html = document.documentElement;

  html.classList.toggle("dark", isDark);
  html.style.colorScheme = isDark ? "dark" : "light";
  html.style.backgroundColor = isDark ? "#0B0B17" : "#F8F9FB";
  document.body.style.backgroundColor = isDark ? "#0B0B17" : "#F8F9FB";
  document.body.style.color = isDark ? "#E2E8F0" : "#1F2937";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = (localStorage.getItem("vezin-theme") as Theme) ?? "light";
    setTheme(stored);
    applyTheme(stored);
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("vezin-theme", next);
    applyTheme(next);
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
