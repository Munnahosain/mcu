import { ArrowUpRight, Github, Twitter } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function MarketingFooter() {
  return (
    <footer className="relative mt-16 overflow-hidden px-4 pb-8 sm:mt-24 sm:px-6 lg:px-8 bg-background text-foreground">
      <div className="mx-auto max-w-7xl">
        <div className="border border-primary/20 rounded-3xl bg-background relative">
          <div className="relative grid gap-8 px-6 py-8 md:grid-cols-[1.6fr_1fr_1fr] md:gap-10 md:px-10 md:py-10">
            {/* Brand column */}
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <span className="liquid-icon-shell h-10 w-10 rounded-xl">
                  <Image src="/MCU-LOGO-0.2V-1.png" alt="MCU Logo" width={28} height={28} className="h-6 w-6 object-contain" />
                </span>
                <div>
                  <p className="text-primary text-[14px] font-bold tracking-[0.18em]">
                    MCUSTOCK
                  </p>
                  <p className="text-[10px] text-primary/60 tracking-[0.2em] uppercase font-bold">
                    AI Automation Suite
                  </p>
                </div>
              </div>
              <p className="text-xs text-primary/80 leading-relaxed max-w-[260px]">
                Professional AI metadata, prompts, and creator workflows — built for stock contributors.
              </p>
              <div className="flex items-center gap-3">
                <a
                  href="#"
                  className="h-9 w-9 rounded-xl border border-primary/20 flex items-center justify-center text-primary/70 hover:text-primary hover:bg-primary/5 transition-colors"
                  aria-label="Twitter"
                >
                  <Twitter className="h-4 w-4" />
                </a>
                <a
                  href="#"
                  className="h-9 w-9 rounded-xl border border-primary/20 flex items-center justify-center text-primary/70 hover:text-primary hover:bg-primary/5 transition-colors"
                  aria-label="GitHub"
                >
                  <Github className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Product links */}
            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-primary/50">Product</p>
              <div className="space-y-2">
                {[
                  { href: "/tools", label: "Tools" },
                  { href: "/pricing", label: "Pricing" },
                  { href: "/docs", label: "Documentation" },
                  { href: "/", label: "Home" },
                ].map((item) => (
                  <Link key={item.label} href={item.href} className="flex items-center gap-1 text-xs font-semibold text-primary/80 hover:text-primary">
                    <span>{item.label}</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Account links */}
            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-primary/50">Account</p>
              <div className="space-y-2">
                {[
                  { href: "/login", label: "Log In" },
                  { href: "/signup", label: "Sign Up Free" },
                ].map((item) => (
                  <Link key={item.label} href={item.href} className="flex items-center gap-1 text-xs font-semibold text-primary/80 hover:text-primary">
                    <span>{item.label}</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Divider + copyright */}
          <div className="relative border-t border-primary/10 px-6 py-4 md:px-10">
            <p className="text-center text-[10px] font-bold tracking-wider text-primary/60">
              © {new Date().getFullYear()} MCUSTOCK AI — Built for creators, by creators.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
