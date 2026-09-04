import { NextResponse } from 'next/server';
import { findUserByEmail, getDatabaseProvider, hasMongoDbConfig, hasSupabaseConfig, tryDevLogin } from '@/lib/database';
import { verifyPassword } from '@/lib/hash';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Please enter your email and password' },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();
    const provider = getDatabaseProvider();

    if (provider === 'mongodb' && !hasMongoDbConfig()) {
      const devUser = await tryDevLogin(emailLower, password);
      if (!devUser) {
        return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
      }
      return NextResponse.json({ success: true, user: devUser });
    }

    if (provider === 'supabase' && !hasSupabaseConfig()) {
      return NextResponse.json(
        { success: false, error: 'Supabase is not configured for auth. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 500 }
      );
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

    return NextResponse.json({ success: true, user: normalizedUser });
  } catch (error: unknown) {
    console.error('Login error:', error);
    const message = error instanceof Error ? error.message : 'Something went wrong during login';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
