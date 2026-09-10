import { NextResponse } from 'next/server';
import { createUser, findUserByEmail, hasMongoDbConfig, tryDevSignup } from '@/server/db/database';
import { hashPassword } from '@/server/auth/hash';
import { createAccessToken, createRefreshToken, REFRESH_COOKIE, refreshCookieOptions } from '@/server/auth/jwt';
import { enforceRateLimit } from '@/server/auth/rate-limit';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export async function POST(req: Request) {
  try {
    const rateLimitError = enforceRateLimit(req, null, {
      limit: 10,
      windowMs: 60 * 1000,
      keyPrefix: 'auth-signup',
    });
    if (rateLimitError) return rateLimitError;

    const body = await req.json().catch(() => ({}));
    const { name, email, password } = body as { name?: string; email?: string; password?: string };

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid name (at least 2 characters).' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim()) || email.trim().length > 100) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim().slice(0, 60);
    const emailLower = email.toLowerCase().trim();
    const hashedPassword = hashPassword(password);

    if (!hasMongoDbConfig()) {
      const devUser = await tryDevSignup(trimmedName, emailLower, hashedPassword);
      if (!devUser) {
        return NextResponse.json({ success: false, error: 'Email already registered' }, { status: 400 });
      }
      const accessToken = await createAccessToken(devUser.id);
      const refreshToken = await createRefreshToken(devUser.id);
      const response = NextResponse.json({ success: true, user: devUser, accessToken });
      response.cookies.set(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
      return response;
    }

    const existingUser = await findUserByEmail(emailLower);
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email already registered' },
        { status: 400 }
      );
    }

    let user: Record<string, unknown> | null = null;
    try {
      user = await createUser({
        name: trimmedName,
        email: emailLower,
        password: hashedPassword,
      }) as Record<string, unknown> | null;
    } catch (createErr: unknown) {
      // MongoDB duplicate key error code 11000
      if (
        createErr &&
        typeof createErr === 'object' &&
        ('code' in createErr && (createErr as { code: number }).code === 11000 ||
          (createErr as { name?: string }).name === 'MongoServerError' ||
          String(createErr).includes('duplicate key') ||
          String(createErr).includes('E11000'))
      ) {
        return NextResponse.json(
          { success: false, error: 'Email already registered' },
          { status: 400 }
        );
      }
      throw createErr;
    }

    const normalizedUser = {
      id: String(user?._id ?? user?.id),
      name: user?.name,
      email: user?.email,
    };

    const accessToken = await createAccessToken(normalizedUser.id);
    const refreshToken = await createRefreshToken(normalizedUser.id);
    const response = NextResponse.json({ success: true, user: normalizedUser, accessToken });
    response.cookies.set(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    return response;
  } catch (error: unknown) {
    console.error('Signup error:', error);
    // Gracefully handle any stray duplicate key errors
    if (
      error &&
      typeof error === 'object' &&
      ('code' in error && (error as { code: number }).code === 11000 ||
        (error as { name?: string }).name === 'MongoServerError' ||
        String(error).includes('duplicate key') ||
        String(error).includes('E11000'))
    ) {
      return NextResponse.json(
        { success: false, error: 'Email already registered' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create account. Please check your credentials and try again.' },
      { status: 500 }
    );
  }
}
