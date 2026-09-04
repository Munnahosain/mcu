import { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  FileEdit,
  FileSpreadsheet,
  Image as ImageIcon,
  MessageSquare,
  PenTool,
  Sparkles,
  Type,
} from "lucide-react";
import MarketingChrome from "../../components/MarketingChrome";
import MarketingFooter from "../../components/MarketingFooter";

export const metadata: Metadata = {
  title: "AI Tools | MCUSTOCK AI",
  description:
    "Explore the suite of AI tools designed to automate your stock image creation workflow.",
};

const tools = [
  {
    icon: <ImageIcon className="h-8 w-8 text-primary" />,
    title: "AI Metadata Engine",
    description:
      "Generate SEO-optimized titles, descriptions, and exactly 49 keywords tailored for major stock agencies.",
    isNew: false,
    href: "/dashboard/metadata",
  },
  {
    icon: <Sparkles className="h-8 w-8 text-primary" />,
    title: "Reverse Prompt Generator",
    description:
      "Convert any visual into a detailed, high-fidelity prompt for Midjourney, DALL-E, or Stable Diffusion.",
    isNew: true,
    href: "/dashboard/prompts",
  },
  {
    icon: <FileSpreadsheet className="h-8 w-8 text-primary" />,
    title: "Multi-Agency CSV Export",
    description:
      "Generate perfectly formatted metadata CSVs for Adobe Stock, Shutterstock, and Freepik in one click.",
    isNew: false,
    href: "/dashboard/metadata",
  },
  {
    icon: <PenTool className="h-8 w-8 text-primary" />,
    title: "Keyword Optimizer",
    description:
      "Refine your tags, add high-ranking search terms, and ensure marketplace discoverability.",
    isNew: false,
    href: "/dashboard/generator",
  },
  {
    icon: <Type className="h-8 w-8 text-primary" />,
    title: "Title Generator",
    description:
      "Create polished titles based on visual context and stock marketplace conventions.",
    isNew: false,
    href: "/dashboard/generator",
  },
  {
    icon: <MessageSquare className="h-8 w-8 text-primary" />,
    title: "AI Caption Generator",
    description:
      "Generate descriptions and agency-friendly copy tuned to your target marketplace.",
    isNew: false,
    href: "/dashboard/generator",
  },
  {
    icon: <FileEdit className="h-8 w-8 text-primary" />,
    title: "SEO File Renamer",
    description:
      "Automatically rename your assets using high-impact keywords to boost search indexing before upload.",
    isNew: true,
    href: "/dashboard/generator",
  },
];

export default function ToolsPage() {
  return (
    <div className="liquid-page-shell min-h-screen pt-28 bg-background text-foreground">
      <MarketingChrome activePath="/tools" />
      <main className="mx-auto max-w-7xl space-y-16 px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <div className="flex justify-center">
            <div className="liquid-badge border border-primary/20 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
              <Sparkles className="h-4 w-4" />
              Professional Stock Creator Toolkit
            </div>
          </div>
          <h1 className="liquid-title text-4xl font-extrabold tracking-tight md:text-6xl text-primary">
            Tools Built for Stock Creators
          </h1>
          <p className="liquid-copy text-lg md:text-xl text-primary/80">
            Our suite of AI tools is engineered for speed and compliance, helping
            you dominate marketplaces like Adobe Stock and Shutterstock.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <div
              key={tool.title}
              className="liquid-card border border-primary/20 rounded-3xl group relative flex flex-col overflow-hidden p-6 md:p-8 bg-background"
            >
              <div className="relative mb-6 h-16 w-16 rounded-[22px] border border-primary/10 flex items-center justify-center bg-primary/5 text-primary">
                {tool.icon}
                {tool.isNew ? (
                  <span className="absolute -right-2 -top-2 rounded-full border border-primary/20 bg-primary text-background px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em]">
                    New
                  </span>
                ) : null}
              </div>
              <h2 className="liquid-title mb-3 text-xl font-semibold text-primary">{tool.title}</h2>
              <p className="liquid-copy mb-6 flex-1 text-primary/80 text-xs leading-relaxed">{tool.description}</p>
              <Link href={tool.href || "/login"} className="liquid-inline-link mt-auto inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                Try this tool
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          ))}
        </div>

        <div className="liquid-card border border-primary/20 rounded-3xl relative mt-24 flex flex-col items-center overflow-hidden p-12 text-center bg-primary/5">
          <h2 className="liquid-title relative z-10 mb-4 text-3xl font-bold text-primary">
            Ready to automate your workflow?
          </h2>
          <p className="liquid-copy relative z-10 mb-8 max-w-xl text-primary/80 text-sm">
            Join creators who are already saving hours every week with MCUSTOCK AI.
          </p>
          <Link href="/signup" className="px-6 py-3 bg-primary text-background rounded-xl text-xs font-bold hover:bg-primary-hover transition-colors">
            Start Generating for Free
          </Link>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
