import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { SupportArticle } from '@/server/models/SupportArticle';

export async function GET(req: Request) {
  try {
    await requireAuthenticatedUser(req);
    await connectToDatabase();
    const url = new URL(req.url);
    const search = url.searchParams.get('search')?.trim().slice(0, 100) || '';
    const categoryId = url.searchParams.get('categoryId');
    const query: Record<string, unknown> = { status: 'published' };
    if (categoryId) query.categoryId = categoryId;
    if (search) query.$text = { $search: search };
    const articles = await SupportArticle.find(query).populate('categoryId', 'name slug icon color').sort(search ? { score: { $meta: 'textScore' } } : { featured: -1, updatedAt: -1 }).limit(50).lean();
    return NextResponse.json({ success: true, articles: articles.map((article) => ({ ...article, _id: String(article._id) })) });
  } catch (error) { return authorizationErrorResponse(error); }
}
