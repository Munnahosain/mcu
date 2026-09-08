import { NextResponse } from 'next/server';
import { createUser, findUserByEmail, hasMongoDbConfig, tryDevSignup } from '@/lib/database';
import { hashPassword } from '@/lib/hash';
import { createAccessToken, createRefreshToken, REFRESH_COOKIE, refreshCookieOptions } from '@/lib/jwt';

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Please provide all fields' },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();
    const hashedPassword = hashPassword(password);
    if (!hasMongoDbConfig()) {
      const devUser = await tryDevSignup(name, emailLower, hashedPassword);
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

    const user = await createUser({
      name: name.trim(),
      email: emailLower,
      password: hashedPassword,
    });

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
    const message = error instanceof Error ? error.message : 'Something went wrong during signup';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
