import { NextResponse } from 'next/server';
import { findUserByEmail, hasMongoDbConfig, tryDevLogin } from '@/server/db/database';
import { verifyPassword } from '@/server/auth/hash';
import { createAccessToken, createRefreshToken, REFRESH_COOKIE, refreshCookieOptions } from '@/server/auth/jwt';

import { enforceRateLimit } from '@/server/auth/rate-limit';

export async function POST(req: Request) {
  try {
    const rateLimitError = enforceRateLimit(req, null, {
      limit: 15,
      windowMs: 60 * 1000,
      keyPrefix: 'auth-login',
    });
    if (rateLimitError) return rateLimitError;

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Please enter your email and password' },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();
    if (!hasMongoDbConfig()) {
      const devUser = await tryDevLogin(emailLower, password);
      if (!devUser) {
        return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
      }
      const accessToken = await createAccessToken(devUser.id);
      const refreshToken = await createRefreshToken(devUser.id);
      const response = NextResponse.json({ success: true, user: devUser, accessToken });
      response.cookies.set(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
      return response;
    }

    const user = await findUserByEmail(emailLower);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const storedPassword = user.password || user.hashed_password || '';
    const isValid = verifyPassword(password, storedPassword);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const normalizedUser = {
      id: String(user._id ?? user.id),
      name: user.name,
      email: user.email,
    };

    const accessToken = await createAccessToken(normalizedUser.id);
    const refreshToken = await createRefreshToken(normalizedUser.id);
    const response = NextResponse.json({ success: true, user: normalizedUser, accessToken });
    response.cookies.set(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    return response;
  } catch (error: unknown) {
    console.error('Login error:', error);
    const message = error instanceof Error ? error.message : 'Something went wrong during login';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
