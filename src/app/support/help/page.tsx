'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Search } from 'lucide-react';

type Article = { _id: string; title: string; slug: string; excerpt: string; updatedAt: string; categoryId?: { name?: string } };

export default function SupportHelpPage() {
  const [search, setSearch] = useState(''); const [articles, setArticles] = useState<Article[]>([]); const [loading, setLoading] = useState(true);
  const [categoryId, setCategoryId] = useState<string | null>(null); const [paramsRead, setParamsRead] = useState(false);
  useEffect(() => { const params = new URLSearchParams(window.location.search); setSearch(params.get('search') || ''); setCategoryId(params.get('categoryId')); setParamsRead(true); }, []);
  useEffect(() => {
    if (!paramsRead) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      const query = new URLSearchParams();
      if (search.trim()) query.set('search', search.trim());
      if (categoryId) query.set('categoryId', categoryId);
      const qs = query.toString();
      fetch(`/api/support/articles${qs ? `?${qs}` : ''}`).then((r) => r.json()).then((data) => { if (!cancelled) setArticles(data.articles || []); }).catch(() => { if (!cancelled) setArticles([]); }).finally(() => { if (!cancelled) setLoading(false); });
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [search, categoryId, paramsRead]);
  return <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-20 pt-8 sm:px-6"><Link href="/support" className="inline-flex items-center gap-2 text-xs font-bold text-foreground/60 hover:text-primary"><ArrowLeft className="h-4 w-4" /> Support Center</Link><header className="mt-8"><p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Help Center</p><h1 className="mt-2 text-4xl font-black">Find an answer</h1><label className="relative mt-6 block max-w-2xl"><Search className="absolute left-4 top-3.5 h-5 w-5 text-foreground/45" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search help articles..." className="w-full rounded-2xl border border-foreground/15 bg-background px-12 py-3.5 text-sm text-foreground outline-none focus:border-primary" /></label></header><section className="mt-10">{loading ? <p className="text-sm text-foreground/55">Searching...</p> : articles.length === 0 ? <div className="rounded-2xl border border-dashed border-foreground/15 p-10 text-center"><BookOpen className="mx-auto h-7 w-7 text-primary" /><p className="mt-3 text-sm text-foreground/60">No articles found.</p><Link href="/support/tickets/new" className="mt-4 inline-block text-xs font-bold text-primary">Create Support Ticket</Link></div> : <div className="grid gap-3 sm:grid-cols-2">{articles.map((article) => <Link key={article._id} href={`/support/help/${article.slug}`} className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 hover:border-primary/40"><p className="text-[10px] font-bold uppercase tracking-wider text-primary">{article.categoryId?.name || 'Help'}</p><h2 className="mt-2 font-bold">{article.title}</h2><p className="mt-2 text-xs leading-relaxed text-foreground/55">{article.excerpt}</p></Link>)}</div>}</section></main>;
}
