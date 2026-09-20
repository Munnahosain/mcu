import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { SupportMessage } from '@/server/models/SupportMessage';
import { SupportTicket } from '@/server/models/SupportTicket';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthenticatedUser(req);
    const { id } = await params;
    await connectToDatabase();
    const ticket = await SupportTicket.findOne({ _id: id, userId: user._id }).populate('categoryId', 'name slug icon color').populate('relatedPaymentId', 'paymentId amount currency status createdAt planNameSnapshot').populate('relatedSubscriptionId', 'planId status startedAt expiresAt currentPeriodEnd').lean();
    if (!ticket) return NextResponse.json({ success: false, error: 'Ticket not found.' }, { status: 404 });
    await SupportTicket.updateOne({ _id: ticket._id }, { $set: { unreadForUser: false } });
    const messages = await SupportMessage.find({ ticketId: ticket._id, internalNote: false }).sort({ createdAt: 1 }).limit(50).lean();
    return NextResponse.json({ success: true, ticket: { ...ticket, _id: String(ticket._id), userId: String(ticket.userId) }, messages: messages.map((message) => ({ ...message, _id: String(message._id), ticketId: String(message.ticketId), senderId: String(message.senderId) })) });
  } catch (error) { return authorizationErrorResponse(error); }
}
