import { NextResponse } from 'next/server';
import { findUserById, resolveUserActivePlan } from '@/server/db/database';
import { isVerifiedDesignatedAdmin } from '@/server/auth/authorization';
import { createAccessToken, createRefreshToken, REFRESH_COOKIE, refreshCookieOptions, verifyRefreshToken } from '@/server/auth/jwt';

export async function POST(req: Request) {
  try {
    const refreshToken = req.headers.get('cookie')
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${REFRESH_COOKIE}=`))
      ?.slice(`${REFRESH_COOKIE}=`.length);

    if (!refreshToken) {
      return NextResponse.json({ success: false, error: 'Refresh token missing' }, { status: 401 });
    }

    const userId = await verifyRefreshToken(decodeURIComponent(refreshToken));
    const user = await findUserById(userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 401 });
    }
    if (user.status && user.status !== 'active') {
      return NextResponse.json({ success: false, error: 'This account is not active.' }, { status: 403 });
    }

    const accessToken = await createAccessToken(userId);
    const rotatedRefreshToken = await createRefreshToken(userId);
    const isConfiguredAdmin = isVerifiedDesignatedAdmin(user);
    const userRole = isConfiguredAdmin ? 'super_admin' : String(user.role ?? 'user');
    const userPlan = await resolveUserActivePlan(user);

    const normalizedUser = {
      id: user._id ? String(user._id) : String(user.id),
      name: String(user.name ?? ''),
      email: String(user.email ?? ''),
      role: userRole,
      avatarUrl: String(user.avatarUrl ?? ''),
      plan: userPlan,
    };
    const response = NextResponse.json({ success: true, accessToken, user: normalizedUser });
    response.cookies.set(REFRESH_COOKIE, rotatedRefreshToken, refreshCookieOptions());
    return response;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid or expired refresh token' }, { status: 401 });
  }
}