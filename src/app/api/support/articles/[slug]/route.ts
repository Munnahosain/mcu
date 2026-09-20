import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { SupportArticle } from '@/server/models/SupportArticle';

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await requireAuthenticatedUser(req);
    const { slug } = await params;
    await connectToDatabase();
    const article = await SupportArticle.findOneAndUpdate({ slug, status: 'published' }, { $inc: { views: 1 } }, { new: true }).populate('categoryId', 'name slug').lean();
    if (!article) return NextResponse.json({ success: false, error: 'Article not found.' }, { status: 404 });
    return NextResponse.json({ success: true, article: { ...article, _id: String(article._id) } });
  } catch (error) { return authorizationErrorResponse(error); }
}
