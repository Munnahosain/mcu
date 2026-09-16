import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/server/db/mongodb';
import { User } from '@/server/models/User';

function matchesSecret(provided: string | null, expected: string | undefined) {
  if (!provided || !expected) return false;
  const actualBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function POST(req: Request) {
  const bootstrapToken = req.headers.get('x-admin-bootstrap-token');
  if (!matchesSecret(bootstrapToken, process.env.ADMIN_BOOTSTRAP_TOKEN)) {
    return NextResponse.json({ success: false, error: 'Invalid bootstrap credentials.' }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  if (!adminEmail) {
    return NextResponse.json({ success: false, error: 'Admin bootstrap is not configured.' }, { status: 503 });
  }

  try {
    await connectToDatabase();
    const existingSuperAdmin = await User.exists({ role: 'super_admin' });
    if (existingSuperAdmin) {
      return NextResponse.json({ success: false, error: 'A Super Admin is already configured.' }, { status: 409 });
    }

    const user = await User.findOneAndUpdate(
      { email: adminEmail },
      { $set: { role: 'super_admin', status: 'active', updatedAt: new Date() } },
      { new: true },
    ).select('_id email role status').lean();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Create the designated admin account first.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Super Admin initialized.', user: { id: String(user._id), email: user.email, role: user.role } });
  } catch (error) {
    console.error('Admin bootstrap error:', error);
    return NextResponse.json({ success: false, error: 'Unable to initialize admin access.' }, { status: 500 });
  }
}