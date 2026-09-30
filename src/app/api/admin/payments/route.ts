import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { Payment } from '@/server/models/Payment';
import { User } from '@/server/models/User';
import { hasMongoDbConfig } from '@/server/db/database-config';
import { inMemoryStore } from '@/server/db/in-memory-store';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search')?.trim().slice(0, 100) || '';
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const limit = [20, 50, 100].includes(Number(url.searchParams.get('limit'))) ? Number(url.searchParams.get('limit')) : 20;

    if (!hasMongoDbConfig()) {
      let filtered = inMemoryStore.payments;
      if (status && ['pending', 'approved', 'rejected', 'cancelled'].includes(status)) {
        filtered = filtered.filter(p => p.status === status);
      }
      if (search) {
        const lower = search.toLowerCase();
        filtered = filtered.filter(p =>
          p.paymentId.toLowerCase().includes(lower) ||
          p.transactionId.toLowerCase().includes(lower) ||
          p.senderNumber.includes(lower) ||
          p.userId.name.toLowerCase().includes(lower) ||
          p.userId.email.toLowerCase().includes(lower)
        );
      }
      const total = filtered.length;
      const paginated = filtered.slice((page - 1) * limit, page * limit);
      const summary: Record<string, { count: number; revenue: number }> = {
        pending: { count: inMemoryStore.payments.filter(p => p.status === 'pending').length, revenue: 0 },
        approved: {
          count: inMemoryStore.payments.filter(p => p.status === 'approved').length,
          revenue: inMemoryStore.payments.filter(p => p.status === 'approved').reduce((acc, p) => acc + p.amount, 0),
        },
        rejected: { count: inMemoryStore.payments.filter(p => p.status === 'rejected').length, revenue: 0 },
      };
      return NextResponse.json({
        success: true,
        payments: paginated,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
        stats: summary,
      });
    }

    await connectToDatabase();
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
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
