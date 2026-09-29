import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { AiCost } from '@/server/models/AiCost';
import { Plan, OFFICIAL_PLANS_SEED } from '@/server/models/Plan';
import { Usage } from '@/server/models/Usage';
import { User } from '@/server/models/User';
import { hasMongoDbConfig } from '@/server/db/database-config';

function getRange(days: number) {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  start.setUTCHours(0, 0, 0, 0);
  return { start, end };
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const requestedDays = Number(new URL(req.url).searchParams.get('days') || '30');
    const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
    const { start, end } = getRange(days);

    if (!hasMongoDbConfig()) {
      return NextResponse.json({
        success: true,
        days,
        range: { start, end },
        newUsers: [{ _id: new Date().toISOString().slice(0, 10), count: 1 }],
        planDistribution: [{ _id: 'super_admin', count: 1 }, { _id: 'user', count: 1 }],
        usage: { metadataGenerated: 0, backgroundRemoved: 0, threeDGenerated: 0, apiRequests: 0, creditsUsed: 0, storageUsedMB: 0 },
        aiCost: [],
        plans: OFFICIAL_PLANS_SEED.length,
      });
    }

    await connectToDatabase();

    const [newUsers, planDistribution, usage, aiCost] = await Promise.all([
      User.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Usage.aggregate([
        { $match: { updatedAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, metadataGenerated: { $sum: '$metadataGenerated' }, backgroundRemoved: { $sum: '$backgroundRemoved' }, threeDGenerated: { $sum: '$threeDGenerated' }, apiRequests: { $sum: '$apiRequests' }, creditsUsed: { $sum: '$creditsUsed' }, storageUsedMB: { $sum: '$storageUsedMB' } } },
      ]),
      AiCost.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: '$provider', estimatedCost: { $sum: '$estimatedCost' }, requests: { $sum: '$requests' } } },
        { $sort: { estimatedCost: -1 } },
      ]),
    ]);

    return NextResponse.json({ success: true, days, range: { start, end }, newUsers, planDistribution, usage: usage[0] || { metadataGenerated: 0, backgroundRemoved: 0, threeDGenerated: 0, apiRequests: 0, creditsUsed: 0, storageUsedMB: 0 }, aiCost, plans: await Plan.countDocuments({ active: true }) });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}