'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';
import ThemedSelect from '@/components/ui/ThemedSelect';

type Category = { _id: string; name: string };
type Payment = { _id: string; paymentId: string; amount: number; status: string };

export default function NewSupportTicketPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState('normal');
  const [relatedPaymentId, setRelatedPaymentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/support/categories').then((response) => response.json()),
      fetch('/api/payments').then((response) => response.json()),
    ])
      .then(([categoryData, paymentData]) => {
        setCategories(categoryData.categories || []);
        setPayments(paymentData.payments || []);
      })
      .catch(() => setError('Unable to load support form.'));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          message,
          categoryId,
          priority,
          relatedPaymentId: relatedPaymentId || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to create ticket.');
      window.location.href = `/support/tickets/${data.ticket.ticketId}`;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create ticket.');
      setSaving(false);
    }
  };

  const categoryOptions = [
    { value: '', label: 'Select category' },
    ...categories.map((category) => ({ value: category._id, label: category.name })),
  ];
  const priorityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'High' },
  ];
  const paymentOptions = [
    { value: '', label: 'No payment selected' },
    ...payments.map((payment) => ({
      value: payment._id,
      label: `${payment.paymentId} · ৳${payment.amount} · ${payment.status}`,
    })),
  ];

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6">
      <Link href="/support" className="inline-flex items-center gap-2 text-xs font-bold text-foreground/60 hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Support Center
      </Link>

      <div className="mt-8">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Contact Support</p>
        <h1 className="mt-2 text-4xl font-black">Create a support ticket</h1>
        <p className="mt-2 text-sm text-foreground/60">Tell us what happened and include the details that will help us investigate.</p>
      </div>

      {error ? <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">{error}</div> : null}

      <form onSubmit={submit} className="mt-8 space-y-5 rounded-3xl border border-foreground/10 bg-foreground/[0.03] p-6 sm:p-8">
        <label className="block text-xs font-bold text-foreground/80">
          Subject
          <input required minLength={5} maxLength={150} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Payment Verification" className="mt-2 w-full rounded-xl border border-foreground/20 bg-background px-3 py-3 text-sm font-medium !text-[#17201e] placeholder:text-foreground/50 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:!text-[#edf2ef]" />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-bold text-foreground/80">
            Category
            <ThemedSelect value={categoryId} onChange={setCategoryId} ariaLabel="Category" options={categoryOptions} className="mt-2" />
          </label>
          <label className="block text-xs font-bold text-foreground/80">
            Priority
            <ThemedSelect value={priority} onChange={setPriority} ariaLabel="Priority" options={priorityOptions} className="mt-2" />
          </label>
        </div>

        <label className="block text-xs font-bold text-foreground/80">
          Related Payment (optional)
          <span className="ml-2 font-normal text-foreground/55">Link a payment if this issue is about a bKash submission.</span>
          <ThemedSelect value={relatedPaymentId} onChange={setRelatedPaymentId} ariaLabel="Related payment" options={paymentOptions} className="mt-2" />
        </label>

        <label className="block text-xs font-bold text-foreground/80">
          Message
          <textarea required minLength={5} maxLength={5000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Describe the issue..." rows={8} className="mt-2 w-full resize-y rounded-xl border border-foreground/20 bg-background px-3 py-3 text-sm font-medium leading-relaxed !text-[#17201e] placeholder:text-foreground/50 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:!text-[#edf2ef]" />
        </label>

        <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-bold text-background disabled:opacity-50">
          <Send className="h-4 w-4" /> {saving ? 'Creating...' : 'Create Ticket'}
        </button>
      </form>
    </main>
  );
}
