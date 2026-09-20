import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { SupportMessage } from '@/server/models/SupportMessage';
import { SupportTicket } from '@/server/models/SupportTicket';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { id } = await params;
    await connectToDatabase();
    const ticket = await SupportTicket.findById(id).populate('userId', 'name email').populate('categoryId', 'name slug color').populate('assignedTo', 'name email role').populate('relatedPaymentId', 'paymentId planNameSnapshot amount currency provider senderNumber transactionId status submittedAt').populate('relatedSubscriptionId', 'planId status startedAt expiresAt currentPeriodEnd').populate('relatedCreditTransactionId', 'type amount reason description createdAt').lean();
    if (!ticket) return NextResponse.json({ success: false, error: 'Ticket not found.' }, { status: 404 });
    await SupportTicket.updateOne({ _id: ticket._id }, { $set: { unreadForAdmin: false } });
    const messages = await SupportMessage.find({ ticketId: ticket._id }).sort({ createdAt: 1 }).limit(100).populate('senderId', 'name email role').lean();
    return NextResponse.json({ success: true, ticket: { ...ticket, _id: String(ticket._id), viewedBy: String(admin._id) }, messages: messages.map((message) => ({ ...message, _id: String(message._id), ticketId: String(message.ticketId) })) });
  } catch (error) { return authorizationErrorResponse(error); }
}
