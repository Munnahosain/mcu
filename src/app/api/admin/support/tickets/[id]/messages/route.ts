import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { AuditLog } from '@/server/models/AuditLog';
import { SupportMessage } from '@/server/models/SupportMessage';
import { SupportTicket } from '@/server/models/SupportTicket';
import { enforceRateLimit } from '@/server/auth/rate-limit';
import { sanitizeSupportText } from '@/server/services/support-service';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const limited = enforceRateLimit(req, String(admin._id), { limit: 30, windowMs: 15 * 60 * 1000, keyPrefix: 'admin-support-message' });
    if (limited) return limited;
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const message = sanitizeSupportText(body.message, 5000);
    const internalNote = body.internalNote === true;
    if (message.length < 1) return NextResponse.json({ success: false, error: 'Message is required.' }, { status: 400 });
    await connectToDatabase();
    const ticket = await SupportTicket.findById(id);
    if (!ticket) return NextResponse.json({ success: false, error: 'Ticket not found.' }, { status: 404 });
    await SupportMessage.create({ ticketId: ticket._id, senderId: admin._id, senderRole: admin.role === 'support' ? 'support_agent' : 'admin', message, internalNote });
    const update: Record<string, unknown> = { lastMessageAt: new Date(), lastMessageBy: admin._id, unreadForAdmin: false };
    if (!internalNote) { update.unreadForUser = true; if (!ticket.firstResponseAt) update.firstResponseAt = new Date(); }
    await SupportTicket.updateOne({ _id: ticket._id }, { $set: update });
    await AuditLog.create({ actorId: admin._id, actorRole: admin.role, action: internalNote ? 'INTERNAL_NOTE_ADDED' : 'TICKET_MESSAGE_SENT', targetUserId: ticket.userId, metadata: { ticketId: String(ticket._id) } });
    return NextResponse.json({ success: true });
  } catch (error) { return authorizationErrorResponse(error); }
}
