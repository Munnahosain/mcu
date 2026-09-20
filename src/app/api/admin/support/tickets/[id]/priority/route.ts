import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { AuditLog } from '@/server/models/AuditLog';
import { SupportTicket } from '@/server/models/SupportTicket';
import { isSupportPriority } from '@/server/services/support-service';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const admin = await requireAdmin(req); const { id } = await params; const body = await req.json().catch(() => ({})); if (!isSupportPriority(body.priority)) return NextResponse.json({ success: false, error: 'Invalid priority.' }, { status: 400 }); await connectToDatabase(); const ticket = await SupportTicket.findByIdAndUpdate(id, { $set: { priority: body.priority } }, { new: true }).select('_id userId priority').lean(); if (!ticket) return NextResponse.json({ success: false, error: 'Ticket not found.' }, { status: 404 }); await AuditLog.create({ actorId: admin._id, actorRole: admin.role, action: 'TICKET_PRIORITY_CHANGED', targetUserId: ticket.userId, metadata: { ticketId: String(ticket._id), priority: body.priority } }); return NextResponse.json({ success: true, priority: ticket.priority }); } catch (error) { return authorizationErrorResponse(error); }
}
