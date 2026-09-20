import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { Payment } from '@/server/models/Payment';
import { User } from '@/server/models/User';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    await connectToDatabase();
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search')?.trim().slice(0, 100) || '';
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const limit = [20, 50, 100].includes(Number(url.searchParams.get('limit'))) ? Number(url.searchParams.get('limit')) : 20;
    const query: Record<string, unknown> = {};
    if (status && ['pending', 'approved', 'rejected', 'cancelled'].includes(status)) query.status = status;
    if (from || to) {
      query.createdAt = {};
      if (from && !Number.isNaN(Date.parse(from))) (query.createdAt as Record<string, Date>).$gte = new Date(`${from}T00:00:00.000Z`);
      if (to && !Number.isNaN(Date.parse(to))) (query.createdAt as Record<string, Date>).$lte = new Date(`${to}T23:59:59.999Z`);
    }
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const users = await User.find({ $or: [{ name: { $regex: escaped, $options: 'i' } }, { email: { $regex: escaped, $options: 'i' } }] }, { _id: 1 }).limit(100).lean();
      query.$or = [
        { paymentId: { $regex: escaped, $options: 'i' } },
        { transactionId: { $regex: escaped, $options: 'i' } },
        { senderNumber: { $regex: escaped, $options: 'i' } },
        { userId: { $in: users.map((user) => user._id) } },
      ];
    }
    const [payments, total, stats] = await Promise.all([
      Payment.find(query).populate('userId', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Payment.countDocuments(query),
      Payment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$amount', 0] } } } }]),
    ]);
    const summary = stats.reduce((result, item) => {
      result[item._id as string] = { count: item.count, revenue: item.revenue };
      return result;
    }, {} as Record<string, { count: number; revenue: number }>);
    return NextResponse.json({ success: true, payments: payments.map((p) => ({ ...p, _id: String(p._id), userId: p.userId && typeof p.userId === 'object' ? { ...p.userId, _id: String(p.userId._id) } : String(p.userId) })), pagination: { page, limit, total, pages: Math.ceil(total / limit) }, stats: summary });
  } catch (error) { return authorizationErrorResponse(error); }
}
