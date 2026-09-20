import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { SupportCategory } from '@/server/models/SupportCategory';
import { SupportTicket } from '@/server/models/SupportTicket';
import { SupportSettings } from '@/server/models/SupportSettings';
import { enforceRateLimit } from '@/server/auth/rate-limit';
import { createTicketWithMessage, ensureSupportCategories, isSupportPriority, sanitizeSupportText, verifyTicketLinks } from '@/server/services/support-service';

export async function GET(req: Request) {
  try {
    const user = await requireAuthenticatedUser(req);
    await connectToDatabase();
    const tickets = await SupportTicket.find({ userId: user._id }).populate('categoryId', 'name slug icon color').sort({ lastMessageAt: -1 }).limit(100).lean();
    return NextResponse.json({ success: true, tickets: tickets.map((ticket) => ({ ...ticket, _id: String(ticket._id), userId: String(ticket.userId), categoryId: ticket.categoryId && typeof ticket.categoryId === 'object' ? { ...ticket.categoryId, _id: String(ticket.categoryId._id) } : String(ticket.categoryId) })) });
  } catch (error) { return authorizationErrorResponse(error); }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuthenticatedUser(req);
    const limited = enforceRateLimit(req, String(user._id), { limit: 5, windowMs: 60 * 60 * 1000, keyPrefix: 'support-ticket' });
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const subject = sanitizeSupportText(body.subject, 150);
    const message = sanitizeSupportText(body.message, 5000);
    const categoryId = typeof body.categoryId === 'string' ? body.categoryId.trim() : '';
    const priority = isSupportPriority(body.priority) && body.priority !== 'urgent' ? body.priority : 'normal';
    if (subject.length < 5) return NextResponse.json({ success: false, error: 'Subject must be at least 5 characters.' }, { status: 400 });
    if (message.length < 5) return NextResponse.json({ success: false, error: 'Message must be at least 5 characters.' }, { status: 400 });
    await connectToDatabase();
    const supportSettings = await SupportSettings.findOne({ key: 'default' }).lean();
    if (supportSettings && (!supportSettings.supportEnabled || !supportSettings.allowNewTickets)) return NextResponse.json({ success: false, error: 'Support ticket submission is temporarily unavailable.' }, { status: 503 });
    await ensureSupportCategories();
    const category = await SupportCategory.findOne({ _id: categoryId, enabled: true }).select('_id');
    if (!category) return NextResponse.json({ success: false, error: 'Please select a valid support category.' }, { status: 400 });
    const links = await verifyTicketLinks(String(user._id), body);
    const result = await createTicketWithMessage({ userId: String(user._id), subject, categoryId: String(category._id), priority, message, links, relatedTool: typeof body.relatedTool === 'string' ? body.relatedTool : '' });
    return NextResponse.json({ success: true, ticket: result, message: `Thanks for contacting MCUSTOCK Support. Your ticket ${result.ticketNumber} has been created.` }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('RELATED_')) return NextResponse.json({ success: false, error: 'The linked record does not belong to your account.' }, { status: 403 });
    return authorizationErrorResponse(error);
  }
}
