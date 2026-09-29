import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { User } from '@/server/models/User';
import { hasMongoDbConfig } from '@/server/db/database-config';
import { listDevUsers } from '@/server/auth/dev-auth';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    if (!hasMongoDbConfig()) {
      const devUsers = listDevUsers();
      return NextResponse.json({
        success: true,
        stats: {
          totalUsers: Math.max(1, devUsers.length),
          activeUsers: Math.max(1, devUsers.filter(u => u.status === 'active').length),
          suspendedUsers: devUsers.filter(u => u.status === 'suspended').length,
          bannedUsers: devUsers.filter(u => u.status === 'banned').length,
          admins: Math.max(1, devUsers.filter(u => ['super_admin', 'admin', 'support'].includes(u.role)).length),
        },
        recentUsers: devUsers.slice(0, 8).map(u => ({
          _id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status,
          createdAt: u.createdAt,
        })),
      });
    }

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