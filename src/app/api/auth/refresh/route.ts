import { NextResponse } from 'next/server';
import { findUserById } from '@/lib/database';
import { createAccessToken, createRefreshToken, REFRESH_COOKIE, refreshCookieOptions, verifyRefreshToken } from '@/lib/jwt';

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

    const accessToken = await createAccessToken(userId);
    const rotatedRefreshToken = await createRefreshToken(userId);
    const response = NextResponse.json({ success: true, accessToken });
    response.cookies.set(REFRESH_COOKIE, rotatedRefreshToken, refreshCookieOptions());
    return response;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid or expired refresh token' }, { status: 401 });
  }
}