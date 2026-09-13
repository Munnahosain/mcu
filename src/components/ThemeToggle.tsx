"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type ThemeMode = "dark" | "light";

interface ThemeToggleProps {
  className?: string;
  iconOnly?: boolean;
}

export default function ThemeToggle({ className = "", iconOnly = false }: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mcustock_theme") as ThemeMode | null;
      const initial =
        saved === "light" || saved === "dark"
          ? saved
          : document.documentElement.classList.contains("light")
          ? "light"
          : "dark";

      document.documentElement.classList.remove("dark", "light");
      document.documentElement.classList.add(initial);
      setTheme(initial);
    } catch {
      document.documentElement.classList.remove("dark", "light");
      document.documentElement.classList.add("dark");
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(theme);
  }, [theme, mounted]);

  const toggleTheme = () => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("mcustock_theme", next);
    } catch {
      // Ignore storage errors
    }
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(next);
  };

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className={`group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--sidebar-border)] bg-[var(--input-bg)] text-primary shadow-sm transition-all duration-300 hover:scale-105 hover:border-primary/40 hover:bg-primary/10 active:scale-95 ${className}`.trim()}
      >
        <div className="relative h-4 w-4 transition-transform duration-500 ease-out">
          {theme === "dark" ? (
            <Moon className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
          ) : (
            <Sun className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" />
          )}
        </div>
      </button>
    );
  }

  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      aria-checked={isLight}
      role="switch"
      className={`group relative inline-flex h-9 w-[78px] items-center rounded-full border border-primary/20 bg-[var(--input-bg)] p-1 transition-all duration-300 hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`.trim()}
    >
      {/* Sliding Pill Indicator */}
      <span
        className={`absolute h-7 w-7 rounded-full bg-primary text-background shadow-[0_4px_10px_rgba(15,174,116,0.35)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center justify-center will-change-transform ${
          isLight ? "translate-x-[42px]" : "translate-x-0"
        }`}
      >
        {isLight ? (
          <Sun className="h-3.5 w-3.5 text-white transition-transform duration-300 rotate-0" />
        ) : (
          <Moon className="h-3.5 w-3.5 text-white transition-transform duration-300 rotate-0" />
        )}
      </span>

      {/* Label Text behind thumb */}
      <span className="flex w-full justify-between px-2 text-[10px] font-extrabold uppercase tracking-wider select-none text-[var(--text-muted)]">
        <span className={`transition-opacity duration-200 ${!isLight ? "opacity-0" : "opacity-80"}`}>Dark</span>
        <span className={`transition-opacity duration-200 ${isLight ? "opacity-0" : "opacity-80"}`}>Light</span>
      </span>
    </button>
  );
}
