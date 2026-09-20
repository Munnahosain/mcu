import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { Payment } from '@/server/models/Payment';
import { AuditLog } from '@/server/models/AuditLog';
import { sanitizeText } from '@/server/services/payment-service';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === 'string' ? sanitizeText(body.reason, 500) : '';
    if (!reason) return NextResponse.json({ success: false, error: 'A rejection reason is required.' }, { status: 400 });
    await connectToDatabase();
    const payment = await Payment.findOne({ $or: [{ _id: id }, { paymentId: id }], status: 'pending' });
    if (!payment) return NextResponse.json({ success: false, error: 'Payment is not pending or was not found.' }, { status: 409 });
    const now = new Date();
    payment.status = 'rejected'; payment.rejectionReason = reason; payment.reviewedAt = now; payment.reviewedBy = admin._id;
    await payment.save();
    await AuditLog.create({ actorId: admin._id, actorRole: admin.role, action: 'PAYMENT_REJECTED', targetUserId: payment.userId, metadata: { paymentId: payment.paymentId, reason } });
    return NextResponse.json({ success: true, message: 'Payment rejected.' });
  } catch (error) { return authorizationErrorResponse(error); }
}
