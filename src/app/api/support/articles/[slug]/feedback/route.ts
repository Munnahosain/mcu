import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { SupportArticle } from '@/server/models/SupportArticle';

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await requireAuthenticatedUser(req);
    const { slug } = await params;
    const body = await req.json().catch(() => ({}));
    if (body.helpful !== true && body.helpful !== false) return NextResponse.json({ success: false, error: 'Feedback value is required.' }, { status: 400 });
    await connectToDatabase();
    const article = await SupportArticle.findOneAndUpdate({ slug, status: 'published' }, { $inc: body.helpful ? { helpfulCount: 1 } : { notHelpfulCount: 1 } }, { new: true }).select('helpfulCount notHelpfulCount').lean();
    if (!article) return NextResponse.json({ success: false, error: 'Article not found.' }, { status: 404 });
    return NextResponse.json({ success: true, feedback: article });
  } catch (error) { return authorizationErrorResponse(error); }
}
