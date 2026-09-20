import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { approvePayment } from '@/server/services/payment-service';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { id } = await params;
    const result = await approvePayment(id, String(admin._id), req);
    return NextResponse.json({ success: true, message: 'Payment approved.', payment: result });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'PAYMENT_ALREADY_APPROVED') return NextResponse.json({ success: false, message: 'Payment has already been approved.' }, { status: 409 });
      if (error.message === 'PAYMENT_ALREADY_PROCESSED') return NextResponse.json({ success: false, error: 'This payment has already been processed.' }, { status: 409 });
      if (error.message === 'PAYMENT_NOT_FOUND') return NextResponse.json({ success: false, error: 'Payment not found.' }, { status: 404 });
    }
    return authorizationErrorResponse(error);
  }
}
