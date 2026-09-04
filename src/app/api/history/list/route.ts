import { NextResponse } from 'next/server';
import { getDatabaseProvider, hasMongoDbConfig, hasSupabaseConfig, listUserHistory, normalizeHistoryItem } from '@/lib/database';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Please provide a userId query parameter' },
        { status: 400 }
      );
    }

    const provider = getDatabaseProvider();
    if (provider === 'mongodb' && !hasMongoDbConfig()) {
      return NextResponse.json(
        { success: false, error: 'MongoDB is not configured. Set MONGODB_URI or switch DATABASE_PROVIDER=supabase.' },
        { status: 500 }
      );
    }

    if (provider === 'supabase' && !hasSupabaseConfig()) {
      return NextResponse.json(
        { success: false, error: 'Supabase is not configured for history storage. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' },
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
