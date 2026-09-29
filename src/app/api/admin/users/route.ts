import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { User } from '@/server/models/User';
import { hasMongoDbConfig } from '@/server/db/database-config';
import { listDevUsers } from '@/server/auth/dev-auth';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get('page') || '1') || 1);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || '20') || 20));
    const search = url.searchParams.get('search')?.trim() || '';
    const status = url.searchParams.get('status')?.trim() || '';
    const role = url.searchParams.get('role')?.trim() || '';

    if (!hasMongoDbConfig()) {
      let devUsers = listDevUsers();
      if (search) {
        const lower = search.toLowerCase();
        devUsers = devUsers.filter(u => u.name.toLowerCase().includes(lower) || u.email.toLowerCase().includes(lower));
      }
      if (status) {
        devUsers = devUsers.filter(u => u.status === status);
      }
      if (role) {
        devUsers = devUsers.filter(u => u.role === role);
      }
      const total = devUsers.length;
      const paginated = devUsers.slice((page - 1) * limit, page * limit);
      return NextResponse.json({
        success: true,
        users: paginated.map(u => ({
          _id: u.id,
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status,
          credits: u.credits,
          createdAt: u.createdAt,
          planId: 'free',
        })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
      });
    }

    await connectToDatabase();

    const filter: Record<string, unknown> = {};

    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: pattern }, { email: pattern }];
    }
    if (['active', 'suspended', 'banned', 'pending'].includes(status)) filter.status = status;
    if (['super_admin', 'admin', 'support', 'user'].includes(role)) filter.role = role;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      users: users.map((user) => ({ ...user, _id: String(user._id), planId: user.planId ? String(user.planId) : null })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}