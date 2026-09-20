import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { User } from '@/server/models/User';
import { Payment } from '@/server/models/Payment';
import { SupportTicket } from '@/server/models/SupportTicket';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    await connectToDatabase();
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const priority = url.searchParams.get('priority');
    const search = url.searchParams.get('search')?.trim().slice(0, 100) || '';
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const limit = [20, 50, 100].includes(Number(url.searchParams.get('limit'))) ? Number(url.searchParams.get('limit')) : 20;
    const query: Record<string, unknown> = {};
    if (['open', 'in_progress', 'waiting_for_user', 'waiting_for_support', 'resolved', 'closed'].includes(status || '')) query.status = status;
    if (['low', 'normal', 'high', 'urgent'].includes(priority || '')) query.priority = priority;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const [users, payments] = await Promise.all([
        User.find({ $or: [{ name: { $regex: escaped, $options: 'i' } }, { email: { $regex: escaped, $options: 'i' } }] }, { _id: 1 }).limit(100).lean(),
        Payment.find({ $or: [{ paymentId: { $regex: escaped, $options: 'i' } }, { transactionId: { $regex: escaped, $options: 'i' } }] }, { _id: 1 }).limit(100).lean(),
      ]);
      query.$or = [{ ticketNumber: { $regex: escaped, $options: 'i' } }, { subject: { $regex: escaped, $options: 'i' } }, { userId: { $in: users.map((user) => user._id) } }, { relatedPaymentId: { $in: payments.map((payment) => payment._id) } }];
    }
    const [tickets, total, stats] = await Promise.all([
      SupportTicket.find(query).populate('userId', 'name email').populate('categoryId', 'name slug color').populate('assignedTo', 'name email role').sort({ lastMessageAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      SupportTicket.countDocuments(query),
      SupportTicket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);
    const summary = stats.reduce((result, item) => { result[item._id as string] = item.count; return result; }, {} as Record<string, number>);
    const urgent = await SupportTicket.countDocuments({ priority: 'urgent', status: { $nin: ['closed', 'resolved'] } });
    const resolvedToday = await SupportTicket.countDocuments({ status: 'resolved', resolvedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } });
    return NextResponse.json({ success: true, tickets: tickets.map((ticket) => ({ ...ticket, _id: String(ticket._id) })), pagination: { page, limit, total, pages: Math.ceil(total / limit) }, stats: { ...summary, urgent, resolvedToday } });
  } catch (error) { return authorizationErrorResponse(error); }
}
