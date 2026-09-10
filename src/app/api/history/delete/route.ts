import { NextResponse } from 'next/server';
import { clearUserHistory, deleteHistoryItem, hasMongoDbConfig } from '@/server/db/database';
import { getAuthenticatedUserId } from '@/server/auth/request-auth';

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json().catch(() => ({ id: undefined }));
    const userId = await getAuthenticatedUserId(req);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!hasMongoDbConfig()) {
      return NextResponse.json(
        { success: false, error: 'MongoDB is not configured. Set MONGODB_URI.' },
        { status: 500 }
      );
    }

    const deleted = id
      ? await deleteHistoryItem(id, userId)
      : await clearUserHistory(userId);

    return NextResponse.json({
      success: true,
      deleted,
      message: id ? 'History item deleted successfully' : 'History cleared successfully',
    });
  } catch (error: unknown) {
    console.error('History deletion error:', error);
    const message = error instanceof Error ? error.message : 'Something went wrong while deleting history';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
