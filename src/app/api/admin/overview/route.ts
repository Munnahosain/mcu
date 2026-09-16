import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { User } from '@/server/models/User';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    await connectToDatabase();

    const [totalUsers, activeUsers, suspendedUsers, bannedUsers, admins, recentUsers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ status: 'suspended' }),
      User.countDocuments({ status: 'banned' }),
      User.countDocuments({ role: { $in: ['super_admin', 'admin', 'support'] } }),
      User.find({}, { name: 1, email: 1, role: 1, status: 1, createdAt: 1 })
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
    ]);

    return NextResponse.json({
      success: true,
      stats: { totalUsers, activeUsers, suspendedUsers, bannedUsers, admins },
      recentUsers: recentUsers.map((user) => ({ ...user, _id: String(user._id) })),
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}