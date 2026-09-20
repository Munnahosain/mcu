import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { SupportCategory } from '@/server/models/SupportCategory';
import { ensureSupportCategories } from '@/server/services/support-service';

export async function GET(req: Request) {
  try {
    await requireAuthenticatedUser(req);
    await connectToDatabase();
    await ensureSupportCategories();
    const categories = await SupportCategory.find({ enabled: true }).sort({ order: 1 }).lean();
    return NextResponse.json({ success: true, categories: categories.map((category) => ({ ...category, _id: String(category._id) })) });
  } catch (error) { return authorizationErrorResponse(error); }
}
