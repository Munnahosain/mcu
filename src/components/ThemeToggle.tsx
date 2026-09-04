"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type ThemeMode = "dark" | "light";

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Only run on mount - apply saved theme to DOM
    try {
      const saved = localStorage.getItem("mcustock_theme") as ThemeMode | null;
      const initial = saved === "light" || saved === "dark"
        ? saved
        : document.documentElement.classList.contains("light") ? "light" : "dark";

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
      // Ignore storage errors.
    }
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(next);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-checked={theme === "light"}
      role="switch"
      className={`liquid-theme-switch ${theme === "light" ? "is-light" : "is-dark"} ${className}`.trim()}
    >
      <span className="liquid-theme-switch-thumb">
        {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </span>
      <span className="liquid-theme-switch-label">{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}
