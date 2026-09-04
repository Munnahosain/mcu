import { NextResponse } from 'next/server';
import { createUser, findUserByEmail, getDatabaseProvider, hasMongoDbConfig, hasSupabaseConfig, tryDevSignup } from '@/lib/database';
import { hashPassword } from '@/lib/hash';

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
    const provider = getDatabaseProvider();

    if (provider === 'mongodb' && !hasMongoDbConfig()) {
      const devUser = await tryDevSignup(name, emailLower, hashedPassword);
      if (!devUser) {
        return NextResponse.json({ success: false, error: 'Email already registered' }, { status: 400 });
      }
      return NextResponse.json({ success: true, user: devUser });
    }

    if (provider === 'supabase' && !hasSupabaseConfig()) {
      return NextResponse.json(
        { success: false, error: 'Supabase is not configured for auth. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 500 }
      );
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

    return NextResponse.json({ success: true, user: normalizedUser });
  } catch (error: unknown) {
    console.error('Signup error:', error);
    const message = error instanceof Error ? error.message : 'Something went wrong during signup';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
