import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { SecurityEvent } from '@/server/models/SecurityEvent';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    await connectToDatabase();
    const events = await SecurityEvent.find().sort({ createdAt: -1 }).limit(50).lean();
    return NextResponse.json({ success: true, events: events.map((event) => ({ ...event, _id: String(event._id), userId: event.userId ? String(event.userId) : null })) });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
