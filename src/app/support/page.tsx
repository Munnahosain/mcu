'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen, LifeBuoy, MessageCircle, Plus, Search, Ticket } from 'lucide-react';

type Category = { _id: string; name: string; slug: string; icon?: string; color?: string };
type TicketItem = { _id: string; ticketNumber: string; subject: string; status: string; priority: string; lastMessageAt: string; categoryId?: { name?: string } };
type WhatsApp = { enabled: boolean; url?: string; availabilityText?: string };

export default function SupportPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [search, setSearch] = useState('');
  const [whatsapp, setWhatsapp] = useState<WhatsApp | null>(null);
  const [showAllTopics, setShowAllTopics] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/support/categories').then((response) => response.json()),
      fetch('/api/support/tickets').then((response) => response.json()),
      fetch('/api/support/whatsapp').then((response) => response.json()),
    ]).then(([categoryData, ticketData, whatsappData]) => {
      setCategories(categoryData.categories || []);
      setTickets(ticketData.tickets || []);
      if (whatsappData.success && whatsappData.enabled && whatsappData.url) setWhatsapp(whatsappData);
    }).catch(() => undefined);
  }, []);

  const openWhatsApp = async () => {
    if (!whatsapp?.url) return;
    await fetch('/api/support/whatsapp', { method: 'POST' }).catch(() => undefined);
    window.open(whatsapp.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-10 px-4 pb-20 pt-24 sm:px-6 sm:pt-28 lg:px-8">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-xs font-bold text-foreground/60 transition hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to workspace
      </Link>
      <header className="rounded-3xl border border-foreground/10 bg-foreground/[0.03] p-7 sm:p-10">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-primary"><LifeBuoy className="h-4 w-4" /> MCUSTOCK Support</div>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">How can we help you?</h1>
        <p className="mt-3 max-w-xl text-sm text-foreground/60">Find answers, explore help articles, or start a conversation with our support team.</p>
        <label className="relative mt-7 block max-w-2xl"><Search className="absolute left-4 top-3.5 h-5 w-5 text-foreground/45" /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && search.trim()) window.location.href = `/support/help?search=${encodeURIComponent(search.trim())}`; }} placeholder="Search your problem..." className="w-full rounded-2xl border border-foreground/15 bg-background px-12 py-3.5 text-sm text-foreground outline-none focus:border-primary" /></label>
      </header>
      {whatsapp ? <section className="flex flex-col justify-between gap-5 rounded-3xl border border-[#25D366]/30 bg-[#25D366]/[0.08] p-6 sm:flex-row sm:items-center sm:p-7"><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#25D366] !text-white shadow-lg shadow-[#25D366]/20"><MessageCircle className="h-6 w-6 !text-white" /></div><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#128C4A] dark:text-[#7CFFA8]">Direct support</p><h2 className="mt-1 text-2xl font-black">WhatsApp Support</h2><p className="mt-1 text-sm text-foreground/65">Chat with our support team directly on WhatsApp.</p>{whatsapp.availabilityText ? <p className="mt-2 text-xs text-foreground/50">{whatsapp.availabilityText}</p> : null}</div></div><button type="button" onClick={() => void openWhatsApp()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-xs font-bold !text-white shadow-lg shadow-[#25D366]/20 transition hover:bg-[#1fbd5b]">Chat on WhatsApp <ArrowRight className="h-4 w-4 !text-white" /></button></section> : null}
      <section><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Popular Topics</p><h2 className="mt-1 text-2xl font-black">Browse help by topic</h2></div><button type="button" onClick={() => setShowAllTopics((current) => !current)} className="text-xs font-bold text-primary hover:underline">{showAllTopics ? 'Show less' : 'View all topics'} <ArrowRight className={`inline h-3.5 w-3.5 transition-transform ${showAllTopics ? '-rotate-90' : ''}`} /></button></div><div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{(showAllTopics ? categories : categories.slice(0, 4)).map((category) => <Link key={category._id} href={`/support/help?categoryId=${category._id}`} className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 transition hover:-translate-y-0.5 hover:border-primary/40"><BookOpen className="h-5 w-5 text-primary" /><h3 className="mt-4 font-bold">{category.name}</h3><p className="mt-1 text-xs text-foreground/55">Browse related answers</p></Link>)}</div></section>
      <section className="rounded-3xl border border-foreground/10 bg-foreground/[0.03] p-6 sm:p-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">My Support Tickets</p><h2 className="mt-1 text-2xl font-black">Recent conversations</h2></div><Link href="/support/tickets/new" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-background"><Plus className="h-4 w-4" /> Create New Ticket</Link></div><div className="mt-6 space-y-2">{tickets.length === 0 ? <div className="rounded-2xl border border-dashed border-foreground/15 p-8 text-center text-sm text-foreground/55">No support tickets yet.</div> : tickets.slice(0, 8).map((ticket) => <Link key={ticket._id} href={`/support/tickets/${ticket._id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-foreground/10 p-4 transition hover:border-primary/40"><div><p className="text-xs font-bold text-primary">{ticket.ticketNumber}</p><p className="mt-1 font-semibold">{ticket.subject}</p><p className="mt-1 text-xs text-foreground/50">{ticket.categoryId?.name || 'Support'} · {new Date(ticket.lastMessageAt).toLocaleString()}</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase text-primary">{ticket.status.replaceAll('_', ' ')}</span></Link>)}</div></section>
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-xs font-bold text-foreground/60 hover:text-primary"><Ticket className="h-4 w-4" /> Back to workspace</Link>
    </main>
  );
}
