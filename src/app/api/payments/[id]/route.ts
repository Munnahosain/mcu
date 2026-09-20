import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { Payment } from '@/server/models/Payment';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthenticatedUser(req);
    const { id } = await params;
    await connectToDatabase();
    const payment = await Payment.findOne({ paymentId: id, userId: user._id }).lean();
    if (!payment) return NextResponse.json({ success: false, error: 'Payment not found.' }, { status: 404 });
    return NextResponse.json({ success: true, payment: { ...payment, _id: String(payment._id), userId: String(payment.userId), planId: String(payment.planId) } });
  } catch (error) { return authorizationErrorResponse(error); }
}
