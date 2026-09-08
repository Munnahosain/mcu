import { NextResponse } from 'next/server';
import { hasMongoDbConfig, listUserHistory, normalizeHistoryItem } from '@/lib/database';
import { getAuthenticatedUserId } from '@/lib/request-auth';

export async function GET(req: Request) {
  try {
    const userId = await getAuthenticatedUserId(req);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 400 }
      );
    }

    if (!hasMongoDbConfig()) {
      return NextResponse.json(
        { success: false, error: 'MongoDB is not configured. Set MONGODB_URI.' },
        { status: 500 }
      );
    }

    const history = await listUserHistory(userId);
    return NextResponse.json({
      success: true,
      history: history.map((item) => normalizeHistoryItem(item)),
    });
  } catch (error: unknown) {
    console.error('History list fetch error:', error);
    const message = error instanceof Error ? error.message : 'Something went wrong while fetching history';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
