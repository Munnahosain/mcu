"use client";

import { useState } from "react";
import { BarChart3, BrainCircuit, ChevronDown, Heart, Search, Sparkles, UserRound } from "lucide-react";

type Asset = { title: string; type: string; creator: string; ai: boolean; age: string; tone: string; image: string };

const demoSeeds = [
  "Finance as a swirling vortex of currency symbols", "Abstract business technology background", "Modern workspace with natural light", "Colorful geometric gradient composition", "Minimal landscape with soft blue horizon", "Professional team collaboration in office", "Neon technology network and data flow", "Organic tropical leaves pattern", "Creative artist desk with materials", "Elegant product presentation on green", "Sunset ocean waves and warm light", "Futuristic city architecture at night",
];
const previewImages = [
  "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=900&q=80",
];
const demoAssets: Asset[] = Array.from({ length: 48 }, (_, index) => ({
  title: `${demoSeeds[index % demoSeeds.length]} ${index > 11 ? `concept ${index + 1}` : ""}`.trim(),
  type: index % 3 === 1 ? "Vector" : "Photo/Image",
  creator: ["MCU Stock Lab", "Creative Studio", "Stock Creator", "Visual Foundry"][index % 4],
  ai: index % 3 !== 1,
  age: index % 4 === 0 ? "2 years ago" : index % 4 === 1 ? "4 months ago" : `${index + 2} days ago`,
  tone: ["#0b5264, #16c784", "#172554, #a7f3d0", "#f59e0b, #ef4444", "#be185d, #fbcfe8"][index % 4],
  image: previewImages[index % previewImages.length],
}));

export default function AnalyticsPage() {
  const [mode, setMode] = useState<"keyword" | "contributor">("keyword");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("Relevance");
  const [contentType, setContentType] = useState("All Asset Types");
  const [aiFilter, setAiFilter] = useState("All Content (Include AI)");
  const [hasSearched, setHasSearched] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const filteredResults = hasSearched && query.trim()
    ? demoAssets.filter((asset) =>
      (contentType === "All Asset Types" || asset.type === contentType) &&
      (aiFilter === "All Content (Include AI)" || (aiFilter === "AI Generated" ? asset.ai : !asset.ai))
    )
    : [];
  const results = filteredResults.slice(0, visibleCount);

  return (
    <div className="space-y-8">
      <header className="space-y-3"><div className="liquid-chip w-fit"><BarChart3 className="h-4 w-4" /> Market Research</div><h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">Adobe Analytics</h1><p className="max-w-2xl text-sm leading-relaxed text-foreground/60 sm:text-base">Search and analyze top-performing assets on Adobe Stock. Discover trends, explore winning content, and find inspiration for your next upload.</p></header>
      <section className="liquid-card space-y-6 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex rounded-full border border-primary/20 bg-primary/5 p-1"><button onClick={() => setMode("keyword")} className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${mode === "keyword" ? "border border-primary bg-primary/20 text-primary shadow-[0_0_12px_rgba(22,199,132,0.2)]" : "border-0 bg-transparent text-foreground/50 hover:text-primary"}`}>Search by Keyword</button><button onClick={() => setMode("contributor")} className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${mode === "contributor" ? "border border-primary bg-primary/20 text-primary shadow-[0_0_12px_rgba(22,199,132,0.2)]" : "border-0 bg-transparent text-foreground/50 hover:text-primary"}`}>Search by Contributor ID</button></div><button className="liquid-button-secondary !rounded-xl !px-4 !py-2 text-xs"><Heart className="h-4 w-4" /> Moodboards</button></div>
        <form onSubmit={(event) => { event.preventDefault(); setHasSearched(true); setVisibleCount(12); }} className="flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground/45" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={mode === "keyword" ? "Search for vectors, photos, illustrations..." : "Enter Adobe contributor ID..."} className="h-14 w-full rounded-2xl border border-foreground/10 bg-white/50 pl-12 pr-4 text-sm text-foreground outline-none dark:bg-white/5" /></label><button type="submit" className="liquid-button-primary !h-14 !rounded-2xl !px-7"><Search className="h-4 w-4" /> Analyze</button></form>
        <div className="grid gap-3 border-t border-foreground/10 pt-5 md:grid-cols-3"><Filter label="Sort By" value={sort} onChange={setSort} options={["Relevance", "Most Recent", "Most Popular"]} /><Filter label="Content Type" value={contentType} onChange={setContentType} options={["All Asset Types", "Photo/Image", "Vector"]} /><Filter label="Generative AI" value={aiFilter} onChange={setAiFilter} options={["All Content (Include AI)", "AI Generated", "Non-AI"]} /></div>
      </section>
      {hasSearched && query.trim() ? <section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">Results for &quot;{query}&quot;</h2><p className="mt-1 text-xs text-foreground/50">{filteredResults.length} preview assets available until Adobe Stock API is connected.</p></div><span className="rounded-full border border-primary/20 px-3 py-1.5 text-xs font-bold">{filteredResults.length} Assets Found</span></div>{results.length ? <><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{results.map((asset) => <AssetCard key={asset.title} asset={asset} />)}</div>{visibleCount < filteredResults.length && <div className="flex justify-center"><button onClick={() => setVisibleCount((count) => count + 12)} className="liquid-button-secondary !rounded-xl">Load more results</button></div>}</> : <div className="liquid-card flex min-h-56 flex-col items-center justify-center gap-3 text-center"><BrainCircuit className="h-10 w-10 text-primary/50" /><p className="font-bold">No assets match the selected filters</p><p className="text-xs text-foreground/55">Try another content type or AI filter.</p></div>}</section> : <div className="liquid-card flex min-h-44 items-center justify-center text-center text-sm text-foreground/50">Enter a keyword or contributor ID to start market research.</div>}
    </div>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="space-y-2 text-[10px] font-bold uppercase tracking-widest text-foreground/50"><span>{label}</span><span className="relative block"><select value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full appearance-none rounded-xl border border-foreground/10 bg-white/50 px-3 text-sm font-medium normal-case tracking-normal text-foreground outline-none dark:bg-white/5">{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" /></span></label>;
}

function AssetCard({ asset }: { asset: Asset }) {
  return <article className="overflow-hidden rounded-2xl border border-foreground/10 bg-white/60 dark:bg-white/5"><div className="relative h-40 bg-cover bg-center" style={{ backgroundImage: `url(${asset.image}), linear-gradient(135deg, ${asset.tone})` }}><div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" /><span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-foreground">{asset.type}</span><span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-1 text-[10px] font-bold text-white">{asset.ai ? "AI Generated" : "Non-AI"}</span></div><div className="space-y-3 p-4"><h3 className="line-clamp-2 font-bold">{asset.title}</h3><div className="flex items-center gap-2 text-xs text-foreground/55"><UserRound className="h-4 w-4" /> {asset.creator}<span className="ml-auto">{asset.age}</span></div></div></article>;
}
