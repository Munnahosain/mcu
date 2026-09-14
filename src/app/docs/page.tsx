import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Box, CalendarDays, CheckCircle2, Eraser, FileDown, Grid3X3, ImagePlus, KeyRound, Palette, Settings2, TerminalSquare, Type, WandSparkles } from "lucide-react";
import MarketingChrome from "@/components/MarketingChrome";
import MarketingFooter from "@/components/MarketingFooter";

export const metadata: Metadata = {
  title: "Docs | MCUSTOCK AI",
  description: "Set up MCUSTOCK AI and learn the workflow behind metadata, prompts, 3D assets, layouts, palettes, and exports.",
};

const sections = [
  ["#start", "Start here"],
  ["#providers", "Provider keys"],
  ["#generator", "Metadata workflow"],
  ["#visual-tools", "Visual tools"],
  ["#exports", "Exports"],
  ["#troubleshooting", "Troubleshooting"],
];

const tools = [
  { icon: WandSparkles, title: "Generator", href: "/dashboard/generator", text: "Upload a batch, choose a model provider, and generate SEO titles, descriptions, categories, keywords, and prompt ideas." },
  { icon: Box, title: "3D Icon Studio", href: "/dashboard/3d-icon-studio", text: "Load an SVG, tune material, bevel, lighting, camera, and background, then export a polished 3D asset." },
  { icon: Eraser, title: "BG Remover", href: "/dashboard/bg-remover", text: "Send image files through the remove.bg integration and download transparent PNG results." },
  { icon: Grid3X3, title: "Grid + Bento", href: "/dashboard/grid-generator", text: "Build structured compositions with grid presets, widgets, responsive sizing, and SVG export." },
  { icon: Palette, title: "Palette", href: "/dashboard/palette", text: "Extract colors from an image and copy CSS variables or download JSON and SVG swatches." },
  { icon: Type, title: "Typebox", href: "/dashboard/typebox", text: "Create kinetic typography and 3D text treatments with preset effects and vector export." },
  { icon: TerminalSquare, title: "ASCII", href: "/dashboard/ascii", text: "Convert images into adjustable ASCII art with density, contrast, and character controls." },
  { icon: CalendarDays, title: "Events", href: "/dashboard/events", text: "Browse the 2026 event calendar, generate event ideas, and export planning data." },
];

function CodeLine({ children }: { children: React.ReactNode }) {
  return <code className="rounded-lg border border-primary/15 bg-primary/[0.06] px-2 py-1 font-mono text-[11px] text-primary">{children}</code>;
}

export default function DocsPage() {
  return (
    <div className="liquid-page-shell min-h-screen bg-background pt-24 text-foreground lg:pt-28">
      <MarketingChrome activePath="/docs" />
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-16 sm:px-6 lg:flex-row lg:px-8">
        <aside className="hidden h-max shrink-0 space-y-6 rounded-3xl border border-primary/15 bg-foreground/[0.025] p-5 lg:sticky lg:top-28 lg:block lg:w-64">
          <div className="flex items-center gap-2 text-sm font-bold text-primary"><BookOpen className="h-4 w-4" /> In this guide</div>
          <nav className="space-y-1.5 text-xs font-semibold text-foreground/65">{sections.map(([href, label]) => <a key={href} href={href} className="block rounded-xl px-3 py-2 transition-colors hover:bg-primary/10 hover:text-primary">{label}</a>)}</nav>
          <Link href="/dashboard/generator" className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white"><ImagePlus className="h-3.5 w-3.5" /> Open workspace</Link>
        </aside>

        <main className="min-w-0 flex-1 rounded-[2rem] border border-primary/15 bg-foreground/[0.018] p-5 sm:p-8 lg:p-10">
          <div className="max-w-4xl">
            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">Make the workspace yours.</h1>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-foreground/65 sm:text-lg">MCUSTOCK is a connected set of small studios. Configure your providers once, move an asset through the tools you need, and keep every export close to the source.</p>

            <section id="start" className="scroll-mt-28 border-b border-foreground/10 py-12">
              <SectionHeading icon={BookOpen} eyebrow="01 · Start here" title="From account to first export" />
              <div className="mt-6 grid gap-3 sm:grid-cols-3">{[["Create an account", "Use Sign Up, then sign in to open the dashboard."], ["Configure providers", "Open Settings and store at least one supported AI key."], ["Choose a studio", "Generator is the best first stop; every tool can be opened from the dashboard." ]].map(([title, text], index) => <div key={title} className="rounded-2xl border border-foreground/10 bg-background/50 p-4"><span className="text-xs font-black text-primary">0{index + 1}</span><h3 className="mt-3 text-sm font-extrabold">{title}</h3><p className="mt-1 text-xs leading-relaxed text-foreground/60">{text}</p></div>)}</div>
              <p className="mt-6 text-sm leading-relaxed text-foreground/65">The dashboard remembers the current generator queue during a session. Saved API keys are managed separately under Settings, so you can switch models without rebuilding your workflow.</p>
            </section>

            <section id="providers" className="scroll-mt-28 border-b border-foreground/10 py-12">
              <SectionHeading icon={KeyRound} eyebrow="02 · Provider keys" title="Bring the model that fits the job" />
              <p className="mt-5 text-sm leading-relaxed text-foreground/65">The generator supports multiple providers, including Groq, Google Gemini, OpenAI, Mistral AI, and OpenRouter. Add keys from the dashboard Settings page, then select the provider and model inside a workflow.</p>
              <div className="mt-6 rounded-2xl border border-primary/15 bg-primary/[0.05] p-5"><div className="flex items-center gap-2 text-xs font-extrabold text-primary"><Settings2 className="h-4 w-4" /> Recommended setup</div><ol className="mt-4 space-y-3 text-xs font-semibold text-foreground/70"><li><span className="mr-2 text-primary">1.</span>Open Dashboard → Settings → API keys.</li><li><span className="mr-2 text-primary">2.</span>Choose a provider and paste the key. The app stores provider keys separately.</li><li><span className="mr-2 text-primary">3.</span>Return to Generator, Prompts, or Events and select the saved provider.</li></ol></div>
              <p className="mt-5 text-xs text-foreground/55">Never place provider secrets in a public repository or in a client-side environment variable. Remove and rotate a key if it has been exposed.</p>
            </section>

            <section id="generator" className="scroll-mt-28 border-b border-foreground/10 py-12">
              <SectionHeading icon={WandSparkles} eyebrow="03 · Metadata workflow" title="Generate listings in batches" />
              <div className="mt-6 space-y-4 text-sm leading-relaxed text-foreground/65"><p>Use Generator for image analysis and Metadata for an export-focused view. Add images to the queue, select the active provider, adjust title, description, and keyword settings, then run one item or the whole batch.</p><p>Prompt Studio turns the same creative context into prompt sets. CSV tools and Downloads keep the resulting rows and files easy to retrieve.</p></div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">{["Batch image queue", "Provider/model selection", "Title + description limits", "Keyword and prompt output", "CSV export", "History and downloads"].map((item) => <div key={item} className="flex items-center gap-2 rounded-xl border border-foreground/10 bg-background/45 px-3 py-2 text-xs font-semibold"><CheckCircle2 className="h-4 w-4 text-primary" />{item}</div>)}</div>
            </section>

            <section id="visual-tools" className="scroll-mt-28 border-b border-foreground/10 py-12">
              <SectionHeading icon={Palette} eyebrow="04 · Visual tools" title="Choose the right studio" />
              <div className="mt-6 grid gap-3 sm:grid-cols-2">{tools.map(({ icon: Icon, title, href, text }) => <Link key={title} href={href} className="group rounded-2xl border border-foreground/10 bg-background/45 p-4 transition-colors hover:border-primary/35"><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-extrabold"><Icon className="h-4 w-4 text-primary" />{title}</span><ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" /></div><p className="mt-2 text-xs leading-relaxed text-foreground/60">{text}</p></Link>)}</div>
            </section>

            <section id="exports" className="scroll-mt-28 border-b border-foreground/10 py-12">
              <SectionHeading icon={FileDown} eyebrow="05 · Exports" title="Keep the output useful" />
              <p className="mt-5 text-sm leading-relaxed text-foreground/65">Use the export control inside each studio rather than taking screenshots. Generator and Prompt Studio produce CSV files; Palette provides CSS, JSON, and SVG; Grid and Trading provide SVG/PNG paths; 3D Studio provides image, model, and video formats; BG Remover produces transparent PNGs.</p>
              <div className="mt-6 flex flex-wrap gap-2"><CodeLine>CSV</CodeLine><CodeLine>PNG</CodeLine><CodeLine>SVG</CodeLine><CodeLine>JSON</CodeLine><CodeLine>GLB</CodeLine><CodeLine>OBJ</CodeLine><CodeLine>MP4</CodeLine></div>
            </section>

            <section id="troubleshooting" className="scroll-mt-28 py-12">
              <SectionHeading icon={TerminalSquare} eyebrow="06 · Troubleshooting" title="When something looks stuck" />
              <div className="mt-6 space-y-3">{[["The AI request fails", "Check that a provider key is saved, the selected model belongs to that provider, and the key has remaining quota."], ["Background removal returns 403", "The remove.bg key is invalid or expired. Update REMOVE_BG_API_KEY on the server and restart or redeploy."], ["A button looks like it refreshed the page", "Use the latest deployment and hard refresh once. Internal marketing navigation uses client-side routing."], ["A mobile navbar item is not visible", "The mobile bar is horizontally scrollable. Swipe left to reach the remaining tools." ]].map(([title, text]) => <div key={title} className="rounded-2xl border border-foreground/10 bg-background/45 p-4"><h3 className="text-sm font-extrabold text-primary">{title}</h3><p className="mt-1 text-xs leading-relaxed text-foreground/65">{text}</p></div>)}</div>
            </section>
          </div>
        </main>
      </div>
      <MarketingFooter />
    </div>
  );
}

function SectionHeading({ icon: Icon, eyebrow, title }: { icon: typeof BookOpen; eyebrow: string; title: string }) {
  return <div><p className="flex items-center gap-2 text-sm font-semibold text-primary"><Icon className="h-4 w-4" />{eyebrow}</p><h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{title}</h2></div>;
}
