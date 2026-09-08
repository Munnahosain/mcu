import { NextResponse } from 'next/server';
import { createHistoryItem, hasMongoDbConfig, normalizeHistoryItem } from '@/lib/database';

export async function POST(req: Request) {
  try {
    const { userId, filename, title, description, keywords, category } = await req.json();

    if (!userId || !filename || !title) {
      return NextResponse.json(
        { success: false, error: 'Missing userId, filename, or title' },
        { status: 400 }
      );
    }

    if (!hasMongoDbConfig()) {
      return NextResponse.json(
        { success: false, error: 'MongoDB is not configured. Set MONGODB_URI.' },
        { status: 500 }
      );
    }

    const historyItem = await createHistoryItem({ userId, filename, title, description, keywords, category });
    if (!historyItem) {
      return NextResponse.json(
        { success: false, error: 'Unable to save history item' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      historyItem: normalizeHistoryItem(historyItem),
    });
  } catch (error: unknown) {
    console.error('History save error:', error);
    const message = error instanceof Error ? error.message : 'Something went wrong while saving history';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
