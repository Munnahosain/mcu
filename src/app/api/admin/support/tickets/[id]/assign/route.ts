import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { AuditLog } from '@/server/models/AuditLog';
import { User } from '@/server/models/User';
import { SupportTicket } from '@/server/models/SupportTicket';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const admin = await requireAdmin(req); const { id } = await params; const body = await req.json().catch(() => ({})); const assignedTo = body.assignedTo ? String(body.assignedTo) : null; await connectToDatabase(); if (assignedTo) { const agent = await User.findOne({ _id: assignedTo, role: { $in: ['super_admin', 'admin', 'support'] }, status: 'active' }).select('_id'); if (!agent) return NextResponse.json({ success: false, error: 'Assigned support user not found.' }, { status: 400 }); } const ticket = await SupportTicket.findByIdAndUpdate(id, { $set: { assignedTo } }, { new: true }).select('_id userId assignedTo').lean(); if (!ticket) return NextResponse.json({ success: false, error: 'Ticket not found.' }, { status: 404 }); await AuditLog.create({ actorId: admin._id, actorRole: admin.role, action: 'TICKET_ASSIGNED', targetUserId: ticket.userId, metadata: { ticketId: String(ticket._id), assignedTo } }); return NextResponse.json({ success: true, assignedTo }); } catch (error) { return authorizationErrorResponse(error); }
}
