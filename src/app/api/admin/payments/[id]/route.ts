import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { Payment } from '@/server/models/Payment';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    await connectToDatabase();
    const payment = await Payment.findOne({ $or: [{ _id: id }, { paymentId: id }] }).populate('userId', 'name email').lean();
    if (!payment) return NextResponse.json({ success: false, error: 'Payment not found.' }, { status: 404 });
    return NextResponse.json({ success: true, payment: { ...payment, _id: String(payment._id) } });
  } catch (error) { return authorizationErrorResponse(error); }
}
