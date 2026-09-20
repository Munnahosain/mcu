import mongoose from 'mongoose';
import { AuditLog } from '@/server/models/AuditLog';
import { CreditLedger } from '@/server/models/CreditLedger';
import { Payment } from '@/server/models/Payment';
import { Subscription } from '@/server/models/Subscription';
import { SupportCategory } from '@/server/models/SupportCategory';
import { SupportMessage } from '@/server/models/SupportMessage';
import { SupportTicket, SUPPORT_PRIORITIES, SUPPORT_STATUSES } from '@/server/models/SupportTicket';

export const DEFAULT_SUPPORT_CATEGORIES = [
  ['Getting Started', 'getting-started', 'LifeBuoy'], ['Billing & Payment', 'billing-payment', 'CreditCard'], ['Credits', 'credits', 'Coins'], ['AI Tools', 'ai-tools', 'Bot'], ['Metadata Generator', 'metadata-generator', 'FileText'], ['3D Icon Studio', '3d-icon-studio', 'Box'], ['Background Remover', 'background-remover', 'Eraser'], ['Grid & Bento', 'grid-bento', 'Grid3X3'], ['Color Palette', 'color-palette', 'Palette'], ['Typebox Studio', 'typebox-studio', 'Type'], ['ASCII Studio', 'ascii-studio', 'Binary'], ['Events Calendar', 'events-calendar', 'CalendarDays'], ['Vector Sheet Splitter', 'vector-sheet-splitter', 'Split'], ['Account & Security', 'account-security', 'ShieldCheck'], ['Technical Issue', 'technical-issue', 'Settings'], ['Bug Report', 'bug-report', 'Bug'], ['Feature Request', 'feature-request', 'Lightbulb'], ['Other', 'other', 'MoreHorizontal'],
] as const;

export const DEFAULT_WHATSAPP_MESSAGE = 'Hi MCUSTOCK Support 👋\n\nI need help with my MCUSTOCK account.\n\nUser ID: {USER_ID}\nAccount Email: {USER_EMAIL}\n\nIssue:\n';

export function normalizeWhatsAppNumber(value: unknown) {
  const number = typeof value === 'string' ? value.replace(/[+\s()-]/g, '') : '';
  return /^8801\d{9}$/.test(number) ? number : null;
}

export function buildWhatsAppUrl(number: string, message: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function sanitizeSupportText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.replace(/[<>]/g, '').trim().slice(0, maxLength) : '';
}

export function isSupportPriority(value: unknown): value is typeof SUPPORT_PRIORITIES[number] {
  return typeof value === 'string' && SUPPORT_PRIORITIES.includes(value as typeof SUPPORT_PRIORITIES[number]);
}

export function isSupportStatus(value: unknown): value is typeof SUPPORT_STATUSES[number] {
  return typeof value === 'string' && SUPPORT_STATUSES.includes(value as typeof SUPPORT_STATUSES[number]);
}

export function canTransitionSupportStatus(current: string, next: string) {
  const transitions: Record<string, string[]> = {
    open: ['in_progress', 'closed'], in_progress: ['waiting_for_user', 'waiting_for_support', 'resolved', 'closed'],
    waiting_for_user: ['in_progress', 'closed'], waiting_for_support: ['in_progress', 'resolved', 'closed'], resolved: ['closed', 'in_progress'], closed: ['in_progress'],
  };
  return current === next || transitions[current]?.includes(next) === true;
}

export async function ensureSupportCategories() {
  await Promise.all(DEFAULT_SUPPORT_CATEGORIES.map(([name, slug, icon], order) => SupportCategory.updateOne({ slug }, { $setOnInsert: { name, slug, icon, order, enabled: true } }, { upsert: true })));
  await SupportCategory.updateOne({ slug: 'upscaler' }, { $set: { enabled: false } });
}

export function createTicketNumber() {
  return `MCU-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function verifyTicketLinks(userId: string, body: Record<string, unknown>) {
  const links: Record<string, unknown> = {};
  if (typeof body.relatedPaymentId === 'string' && body.relatedPaymentId) {
    const payment = await Payment.findOne({ _id: body.relatedPaymentId, userId }).select('_id');
    if (!payment) throw new Error('RELATED_PAYMENT_NOT_FOUND');
    links.relatedPaymentId = payment._id;
  }
  if (typeof body.relatedSubscriptionId === 'string' && body.relatedSubscriptionId) {
    const subscription = await Subscription.findOne({ _id: body.relatedSubscriptionId, userId }).select('_id');
    if (!subscription) throw new Error('RELATED_SUBSCRIPTION_NOT_FOUND');
    links.relatedSubscriptionId = subscription._id;
  }
  if (typeof body.relatedCreditTransactionId === 'string' && body.relatedCreditTransactionId) {
    const transaction = await CreditLedger.findOne({ _id: body.relatedCreditTransactionId, userId }).select('_id');
    if (!transaction) throw new Error('RELATED_CREDIT_TRANSACTION_NOT_FOUND');
    links.relatedCreditTransactionId = transaction._id;
  }
  return links;
}

export async function createTicketWithMessage(input: { userId: string; subject: string; categoryId: string; priority: string; message: string; links: Record<string, unknown>; relatedTool?: string }): Promise<{ ticketNumber: string; ticketId: string }> {
  const session = await mongoose.startSession();
  try {
    let result: { ticketNumber: string; ticketId: string } | null = null;
    await session.withTransaction(async () => {
      const ticket = await SupportTicket.create([{ ticketNumber: createTicketNumber(), userId: input.userId, subject: input.subject, categoryId: input.categoryId, priority: input.priority, ...input.links, relatedTool: sanitizeSupportText(input.relatedTool, 100), lastMessageAt: new Date(), lastMessageBy: input.userId, unreadForAdmin: true }], { session });
      await SupportMessage.create([{ ticketId: ticket[0]._id, senderId: input.userId, senderRole: 'user', message: input.message, internalNote: false }], { session });
      await AuditLog.create([{ actorId: input.userId, actorRole: 'user', action: 'TICKET_CREATED', targetUserId: input.userId, metadata: { ticketId: String(ticket[0]._id), ticketNumber: ticket[0].ticketNumber } }], { session });
      result = { ticketNumber: ticket[0].ticketNumber, ticketId: String(ticket[0]._id) };
    });
    if (!result) throw new Error('TICKET_CREATION_FAILED');
    return result;
  } finally { await session.endSession(); }
}
