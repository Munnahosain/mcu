import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { SecurityEvent } from '@/server/models/SecurityEvent';
import { hasMongoDbConfig } from '@/server/db/database-config';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    if (!hasMongoDbConfig()) {
      return NextResponse.json({
        success: true,
        events: [
          {
            _id: 'sec-1',
            type: 'admin_login_success',
            action: 'Authorized admin session active',
            userId: 'dev-admin-id',
            ip: '127.0.0.1',
            userAgent: 'AI Studio Development Environment',
            createdAt: new Date().toISOString(),
          },
        ],
      });
    }

    await connectToDatabase();
    const events = await SecurityEvent.find().sort({ createdAt: -1 }).limit(50).lean();
    return NextResponse.json({ success: true, events: events.map((event) => ({ ...event, _id: String(event._id), userId: event.userId ? String(event.userId) : null })) });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
