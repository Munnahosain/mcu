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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AuthUser, clearAuthUser, getAuthUser } from "@/lib/auth";
import ThemeToggle from "@/components/ThemeToggle";
import { GeneratorStateProvider } from "./GeneratorStateContext";

const sidebarLinks = [
  { name: "Generator", href: "/dashboard/generator", icon: Sparkles },
  { name: "BG Remover", href: "/dashboard/bg-remover", icon: Eraser },
  { name: "3D Icon Studio", href: "/3d-icon-studio", icon: Box },
  { name: "Bento Builder", href: "/dashboard/bento", icon: LayoutIcon },
  { name: "Smart Grid", href: "/grid-generator", icon: Grid3X3 },
  { name: "Live Trading Charts", href: "/live-trading-charts", icon: Activity },
  { name: "Color Palette", href: "/dashboard/palette", icon: Pipette },
  { name: "ASCII Vision", href: "/dashboard/ascii", icon: Binary },
  { name: "Adobe Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Events", href: "/dashboard/events", icon: Zap },
  { name: "Pricing", href: "/dashboard/pricing", icon: Crown },
];

const SIDEBAR_WIDTH = 320;
const COLLAPSED_SIDEBAR_WIDTH = 72;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setUser(getAuthUser());
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
      if (mobile) setSidebarOpen(false);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSignOut = () => {
    clearAuthUser();
    setUser(null);
    router.replace("/login");
  };

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
          transition={{ type: "spring", stiffness: 360, damping: 34, mass: 0.8 }}
          className="fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col overflow-hidden border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] lg:relative lg:z-20"
        >
          <div className={`relative z-10 flex h-24 shrink-0 items-center border-b border-[var(--sidebar-border)] ${isSidebarOpen ? "px-5" : "justify-center px-0"}`}>
            <Link href="/" className={`flex items-center whitespace-nowrap rounded-full hover:opacity-90 ${isSidebarOpen ? "gap-4" : "justify-center"}`}>
              <span className="liquid-icon-shell h-12 w-12 rounded-2xl shrink-0">
                <Image src="/MCU-LOGO-0.2V-1.png" alt="MCU Logo" width={32} height={32} className="h-7 w-7 object-contain" />
              </span>
              <AnimatePresence initial={false}>
                {isSidebarOpen && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                  >
                    <span className="block text-[9px] font-bold uppercase tracking-[0.28em] text-primary/60">Stock Creator AI</span>
                    <span className="text-[18px] font-bold tracking-[0.02em] text-primary">MCUSTOCK</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </Link>
          </div>

          {/* Sidebar Links */}
          <div className={`flex-1 overflow-y-auto py-6 space-y-3 relative z-10 ${isSidebarOpen ? 'px-3.5' : 'px-0 flex flex-col items-center'}`}>
            {isSidebarOpen && <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary/60 mb-2 px-3.5">Main Menu</div>}
            {sidebarLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || (link.href === "/dashboard/generator" && pathname === "/dashboard");
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => { if (isMobile) setSidebarOpen(false); }}
                  className={`flex items-center text-base font-bold transition-all w-full ${isSidebarOpen
                      ? `gap-3.5 px-4 py-3.5 rounded-2xl ${isActive ? "border bg-primary text-background border-primary shadow-lg shadow-primary/10" : "text-primary/80 hover:bg-primary/5 hover:text-primary"}`
                      : `justify-center h-[52px] w-[52px] ${isActive ? "rounded-2xl bg-primary text-background border border-primary shadow-lg shadow-primary/10" : "text-primary hover:bg-primary/5"}`
                    }`}
                  title={!isSidebarOpen ? link.name : undefined}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <AnimatePresence initial={false}>
                    {isSidebarOpen && (
                      <motion.span
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.14, ease: "easeOut" }}
                        className="whitespace-nowrap"
                      >
                        {link.name}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              );
            })}

          </div>

          {/* Fixed theme and sidebar controls */}
          <div className={`sidebar-bottom-controls shrink-0 border-t border-[var(--sidebar-border)] py-4 relative z-10 ${isSidebarOpen ? "px-3.5" : "is-collapsed"}`}>
            <div className="sidebar-theme-control">
              <ThemeToggle />
            </div>
            <button
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="sidebar-collapse-button text-primary/80 hover:text-primary"
              title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          {/* User Signout footer in sidebar */}
          <div className={`p-4 border-t border-[var(--sidebar-border)] shrink-0 flex flex-col gap-3 relative z-10 ${!isSidebarOpen ? 'items-center' : ''}`}>
            <button
              onClick={handleSignOut}
              className={`flex items-center text-base font-bold text-primary border border-primary/20 hover:bg-primary/10 ${isSidebarOpen ? "gap-3.5 px-4 py-3.5 w-full rounded-2xl" : "justify-center h-[52px] w-[52px] rounded-2xl"
                }`}
              title="Sign Out"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              {isSidebarOpen && <span className="whitespace-nowrap">Sign Out</span>}
            </button>
          </div>
        </motion.aside>

        {/* Main Content Pane */}
        <main className="flex-1 flex flex-col min-w-0 bg-transparent overflow-hidden">
          {/* Top Header */}
          <header className="sticky top-0 z-30 h-18 shrink-0 border-b border-[var(--divider)] px-4 backdrop-blur-2xl sm:px-6 flex items-center justify-between bg-[var(--header-bg)]">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 border border-primary/20 rounded-xl text-primary hover:bg-primary/5 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-primary/60">Workspace</p>
                <h1 className="dashboard-workspace-title font-bold text-sm sm:text-base text-primary truncate leading-tight">
                  {sidebarLinks.find(l => l.href === pathname)?.name || "Dashboard"}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 border border-primary/25 bg-primary/5 rounded-full text-[10px] font-bold text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                Workspace Active
              </div>

              {user && (
                <div className="h-10 w-10 border border-primary/30 rounded-xl flex items-center justify-center bg-primary/5 font-bold text-xs text-primary uppercase">
                  {user.name[0] || user.email[0] || "M"}
                </div>
              )}
            </div>
          </header>

          {/* Page Content area */}
          <div className={`flex-1 custom-scrollbar ${pathname === "/dashboard/bento" ? "overflow-hidden" : "overflow-y-auto"}`}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="max-w-none min-h-full w-full p-4 sm:p-6 lg:p-8"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </GeneratorStateProvider>
  );
}
