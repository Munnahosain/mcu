import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { AuditLog } from '@/server/models/AuditLog';
import { SupportTicket } from '@/server/models/SupportTicket';
import { canTransitionSupportStatus, isSupportStatus } from '@/server/services/support-service';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req); const { id } = await params; const body = await req.json().catch(() => ({}));
    if (!isSupportStatus(body.status)) return NextResponse.json({ success: false, error: 'Invalid ticket status.' }, { status: 400 });
    await connectToDatabase(); const ticket = await SupportTicket.findById(id); if (!ticket) return NextResponse.json({ success: false, error: 'Ticket not found.' }, { status: 404 });
    if (!canTransitionSupportStatus(ticket.status, body.status)) return NextResponse.json({ success: false, error: 'This status transition is not allowed.' }, { status: 409 });
    const now = new Date(); const update: Record<string, unknown> = { status: body.status };
    if (body.status === 'resolved') update.resolvedAt = now;
    if (body.status === 'closed') update.closedAt = now;
    if (body.status === 'in_progress' && ticket.status === 'closed') { update.closedAt = null; update.resolvedAt = null; }
    await SupportTicket.updateOne({ _id: ticket._id }, { $set: update });
    await AuditLog.create({ actorId: admin._id, actorRole: admin.role, action: body.status === 'resolved' ? 'TICKET_RESOLVED' : body.status === 'closed' ? 'TICKET_CLOSED' : 'TICKET_STATUS_CHANGED', targetUserId: ticket.userId, metadata: { ticketId: String(ticket._id), status: body.status } });
    return NextResponse.json({ success: true });
  } catch (error) { return authorizationErrorResponse(error); }
}
