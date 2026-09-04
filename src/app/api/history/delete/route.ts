import { NextResponse } from 'next/server';
import { deleteHistoryItem, getDatabaseProvider, hasMongoDbConfig, hasSupabaseConfig } from '@/lib/database';

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing history item id to delete' },
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

    const deleted = await deleteHistoryItem(id);

    return NextResponse.json({
      success: true,
      deleted,
      message: 'History item deleted successfully',
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
