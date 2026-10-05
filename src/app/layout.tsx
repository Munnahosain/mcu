import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GlobalControlBehavior } from "@/components/ui/GlobalControlBehavior";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Design & Retro Raster Studio",
  description:
    "Creative suite featuring Pattern Maker, Halftone, Dither, ASCII Studio, 3D Icon Studio, and design utilities.",
  openGraph: {
    title: "Design & Retro Raster Studio",
    description:
      "Creative suite featuring Pattern Maker, Halftone, Dither, ASCII Studio, 3D Icon Studio, and design utilities.",
  },
  icons: {
    icon: "/MCU-LOGO-0.2V-1.png",
    apple: "/MCU-LOGO-0.2V-1.png",
    shortcut: "/MCU-LOGO-0.2V-1.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth" data-scroll-behavior="smooth">
      <head>
        <script
          id="theme-strategy"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('mcustock_theme') || 'dark';
                  document.documentElement.classList.remove('dark', 'light');
                  document.documentElement.classList.add(theme);
                } catch(e) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${inter.variable} liquid-site antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <GlobalControlBehavior />
        {children}
      </body>
    </html>
  );
}
