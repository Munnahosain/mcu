import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { AuditLog } from '@/server/models/AuditLog';
import { SupportMessage } from '@/server/models/SupportMessage';
import { SupportTicket } from '@/server/models/SupportTicket';
import { enforceRateLimit } from '@/server/auth/rate-limit';
import { canTransitionSupportStatus, sanitizeSupportText } from '@/server/services/support-service';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthenticatedUser(req);
    const limited = enforceRateLimit(req, String(user._id), { limit: 20, windowMs: 15 * 60 * 1000, keyPrefix: 'support-message' });
    if (limited) return limited;
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const message = sanitizeSupportText(body.message, 5000);
    if (message.length < 5) return NextResponse.json({ success: false, error: 'Message must be at least 5 characters.' }, { status: 400 });
    await connectToDatabase();
    const ticket = await SupportTicket.findOne({ _id: id, userId: user._id });
    if (!ticket) return NextResponse.json({ success: false, error: 'Ticket not found.' }, { status: 404 });
    if (ticket.status === 'closed') return NextResponse.json({ success: false, error: 'This ticket is closed.' }, { status: 409 });
    await SupportMessage.create({ ticketId: ticket._id, senderId: user._id, senderRole: 'user', message, internalNote: false });
    const nextStatus = ticket.status === 'waiting_for_user' && canTransitionSupportStatus(ticket.status, 'in_progress') ? 'in_progress' : ticket.status;
    await SupportTicket.updateOne({ _id: ticket._id }, { $set: { lastMessageAt: new Date(), lastMessageBy: user._id, unreadForAdmin: true, unreadForUser: false, status: nextStatus } });
    await AuditLog.create({ actorId: user._id, actorRole: 'user', action: 'TICKET_MESSAGE_SENT', targetUserId: user._id, metadata: { ticketId: String(ticket._id) } });
    return NextResponse.json({ success: true });
  } catch (error) { return authorizationErrorResponse(error); }
}
