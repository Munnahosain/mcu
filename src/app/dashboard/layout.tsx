"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sparkles,
  Eraser,
  Box,
  Layout as LayoutIcon,
  Pipette,
  Binary,
  BarChart3,
  Activity,
  Grid3X3,
  Zap,
  Crown,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Type,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AuthUser, clearAuthUser, getAuthUser } from "@/lib/auth";
import ThemeToggle from "@/components/ThemeToggle";
import { GeneratorStateProvider } from "./GeneratorStateContext";

const sidebarLinks = [
  { name: "Generator", href: "/dashboard/generator", icon: Sparkles },
  { name: "BG Remover", href: "/dashboard/bg-remover", icon: Eraser },
  { name: "3D Icon Studio", href: "/dashboard/3d-icon-studio", icon: Box },
  { name: "Bento Builder", href: "/dashboard/bento", icon: LayoutIcon },
  { name: "Smart Grid", href: "/dashboard/grid-generator", icon: Grid3X3 },
  { name: "Live Trading Charts", href: "/dashboard/trading", icon: Activity },
  { name: "Color Palette", href: "/dashboard/palette", icon: Pipette },
  { name: "Typebox Studio", href: "/dashboard/typebox", icon: Type },
  { name: "ASCII Vision", href: "/dashboard/ascii", icon: Binary },
  { name: "Adobe Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Events", href: "/dashboard/events", icon: Zap },
  { name: "Pricing", href: "/dashboard/pricing", icon: Crown },
];

const SIDEBAR_WIDTH = 320;
const COLLAPSED_SIDEBAR_WIDTH = 72;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setUser(getAuthUser());
      try {
        const saved = localStorage.getItem("mcustock_sidebar_open");
        if (saved !== null) {
          setSidebarOpen(saved === "true");
        } else {
          setSidebarOpen(window.innerWidth >= 1024);
        }
      } catch {
        setSidebarOpen(window.innerWidth >= 1024);
      }
      setIsHydrated(true);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (!user) {
      router.replace("/login");
    }
  }, [isHydrated, router, user]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleToggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("mcustock_sidebar_open", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleSignOut = () => {
    clearAuthUser();
    setUser(null);
    router.replace("/login");
  };

  if (!isHydrated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--main-bg)] text-primary">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      </div>
    );
  }

  return (
    <GeneratorStateProvider>
      <div className="relative flex h-screen overflow-hidden bg-[var(--main-bg)] text-foreground">
        {/* Subtle Aurora Ambient Glow (restricted to primary color) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-10%] top-[-12%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(22,199,132,0.08)_0%,transparent_70%)] blur-3xl" />
          <div className="absolute bottom-[-18%] right-[-8%] h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,rgba(22,199,132,0.06)_0%,transparent_70%)] blur-3xl" />
        </div>

        {/* Overlay for mobile drawer */}
        <AnimatePresence>
          {isMobile && isSidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 transition-opacity border-r border-primary/10"
            />
          )}
        </AnimatePresence>

        {/* Sidebar Navigation */}
        <motion.aside
          initial={false}
          animate={{
            width: isSidebarOpen ? SIDEBAR_WIDTH : (isMobile ? 0 : COLLAPSED_SIDEBAR_WIDTH),
            x: isMobile ? (isSidebarOpen ? 0 : -SIDEBAR_WIDTH) : 0
          }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col overflow-hidden border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] lg:relative lg:z-20"
        >
          {/* Top Brand Header */}
          <div className="relative z-10 flex h-20 shrink-0 items-center border-b border-[var(--sidebar-border)] px-3.5">
            <Link href="/" className="flex items-center whitespace-nowrap rounded-full hover:opacity-90 gap-3">
              <span className="liquid-icon-shell h-11 w-11 rounded-2xl shrink-0 flex items-center justify-center">
                <Image src="/MCU-LOGO-0.2V-1.png" alt="MCU Logo" width={28} height={28} className="h-6 w-6 object-contain" />
              </span>
              <motion.div
                initial={false}
                animate={{
                  opacity: isSidebarOpen ? 1 : 0,
                  width: isSidebarOpen ? "auto" : 0,
                }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden whitespace-nowrap"
              >
                <span className="block text-[9px] font-bold uppercase tracking-[0.28em] text-primary/60">Stock Creator AI</span>
                <span className="text-[17px] font-bold tracking-[0.02em] text-primary">MCUSTOCK</span>
              </motion.div>
            </Link>
          </div>

          {/* Sidebar Links */}
          <div className="flex-1 overflow-y-auto py-4 space-y-1.5 relative z-10 px-2.5">
            <motion.div
              initial={false}
              animate={{
                opacity: isSidebarOpen ? 1 : 0,
                height: isSidebarOpen ? "auto" : 0,
                marginBottom: isSidebarOpen ? 8 : 0,
              }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50 px-3.5"
            >
              Main Menu
            </motion.div>

            {sidebarLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || (link.href === "/dashboard/generator" && pathname === "/dashboard");
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => { if (isMobile && window.innerWidth < 768) setSidebarOpen(false); }}
                  className={`group relative flex items-center h-12 w-full rounded-2xl transition-colors duration-200 px-2.5 ${
                    isActive
                      ? "text-primary font-bold"
                      : "text-foreground/75 hover:text-foreground hover:bg-foreground/[0.04]"
                  }`}
                  title={!isSidebarOpen ? link.name : undefined}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeSidebarLinkPill"
                      className="absolute inset-0 rounded-2xl bg-primary/15 border border-primary/35 shadow-[0_0_20px_rgba(22,199,132,0.12)] -z-0"
                      transition={{
                        duration: 0.22,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    />
                  )}
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                    <Icon className={`w-5 h-5 shrink-0 transition-colors duration-200 ${isActive ? "text-primary stroke-[2.4] drop-shadow-[0_0_8px_rgba(22,199,132,0.35)]" : "text-foreground/50 group-hover:text-primary stroke-[2]"}`} />
                  </div>
                  <motion.span
                    initial={false}
                    animate={{
                      opacity: isSidebarOpen ? 1 : 0,
                      width: isSidebarOpen ? "auto" : 0,
                      x: isSidebarOpen ? 0 : -6,
                    }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className={`ml-3 overflow-hidden whitespace-nowrap text-sm relative z-10 ${isActive ? "text-primary font-bold tracking-wide" : "font-medium group-hover:text-foreground"}`}
                  >
                    {link.name}
                  </motion.span>
                </Link>
              );
            })}
          </div>

          {/* Fixed theme and sidebar controls */}
          <div className={`shrink-0 border-t border-[var(--sidebar-border)] py-3 px-2.5 relative z-10 flex ${
            isSidebarOpen
              ? "flex-row items-center justify-between gap-2"
              : "flex-col items-center gap-2.5"
          } overflow-hidden`}>
            <div className={`flex items-center justify-center ${isSidebarOpen ? "order-1 min-w-0" : "order-2"}`}>
              <ThemeToggle iconOnly={!isSidebarOpen} />
            </div>
            <button
              onClick={handleToggleSidebar}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-primary/80 hover:text-primary hover:bg-primary/10 transition-colors duration-150 ${
                isSidebarOpen ? "order-2" : "order-1"
              }`}
              title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          {/* User Signout footer in sidebar */}
          <div className="p-3 border-t border-[var(--sidebar-border)] shrink-0 flex flex-col gap-2 relative z-10 overflow-hidden">
            <div
              className={`flex items-center gap-3 p-1.5 rounded-2xl border border-[var(--sidebar-border)] bg-foreground/[0.02] overflow-hidden ${
                !isSidebarOpen ? "justify-center" : ""
              }`}
              title={user.email}
            >
              <span className="sidebar-user-avatar shrink-0 relative flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 border border-primary/25 overflow-visible">
                <span className="h-full w-full rounded-full overflow-hidden flex items-center justify-center bg-primary/10">
                  {user.avatarUrl || user.email ? (
                    <img
                      src={
                        user.avatarUrl ||
                        `https://unavatar.io/${encodeURIComponent(user.email)}?fallback=https://ui-avatars.com/api/?name=${encodeURIComponent(
                          user.name || user.email
                        )}&background=16c784&color=071b17&bold=true&size=128`
                      }
                      alt={`${user.name || user.email} avatar`}
                      className="h-full w-full rounded-full object-cover"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.onerror = null;
                        target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          user.name || user.email || "M"
                        )}&background=16c784&color=071b17&bold=true&size=128`;
                      }}
                    />
                  ) : (
                    <span className="font-extrabold text-xs text-primary">
                      {(user.name || user.email || "M").charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="sidebar-user-status" />
              </span>
              <motion.div
                initial={false}
                animate={{
                  opacity: isSidebarOpen ? 1 : 0,
                  width: isSidebarOpen ? "auto" : 0,
                }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="min-w-0 overflow-hidden whitespace-nowrap"
              >
                <span className="block truncate text-xs font-bold text-foreground">{user.name}</span>
                <span className="block truncate text-[10px] font-medium text-foreground/50">{user.email}</span>
              </motion.div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center h-11 w-full rounded-2xl px-2.5 text-sm font-bold text-foreground/75 hover:text-red-500 hover:bg-red-500/10 border border-foreground/10 hover:border-red-500/30 transition-colors duration-200"
              title="Sign Out"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                <LogOut className="w-5 h-5 shrink-0" />
              </div>
              <motion.span
                initial={false}
                animate={{
                  opacity: isSidebarOpen ? 1 : 0,
                  width: isSidebarOpen ? "auto" : 0,
                  x: isSidebarOpen ? 0 : -6,
                }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="ml-3 overflow-hidden whitespace-nowrap"
              >
                Sign Out
              </motion.span>
            </button>
          </div>
        </motion.aside>

        {/* Main Content Pane */}
        <main className="flex-1 flex flex-col min-w-0 bg-transparent overflow-hidden">
          {/* Page Content area */}
          <div className={`flex-1 custom-scrollbar ${pathname === "/dashboard/bento" ? "overflow-hidden" : "overflow-y-auto"}`}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="max-w-none min-h-full w-full p-2.5 sm:p-4 lg:p-5"
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>
    </GeneratorStateProvider>
  );
}
