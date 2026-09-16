import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { Usage } from '@/server/models/Usage';

const numericFields = ['metadataGenerated', 'backgroundRemoved', 'threeDGenerated', 'imagesUploaded', 'apiRequests', 'storageUsedMB', 'creditsUsed'] as const;

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const period = new URL(req.url).searchParams.get('period') || `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return NextResponse.json({ success: false, error: 'Invalid usage period.' }, { status: 400 });
    await connectToDatabase();
    const [summary] = await Usage.aggregate([{ $match: { period } }, { $group: { _id: null, users: { $sum: 1 }, ...Object.fromEntries(numericFields.map((field) => [field, { $sum: `$${field}` }])) } }]);
    return NextResponse.json({ success: true, period, summary: summary || { users: 0, ...Object.fromEntries(numericFields.map((field) => [field, 0])) } });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}