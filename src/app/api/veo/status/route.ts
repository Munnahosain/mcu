import { GoogleGenAI, GenerateVideosOperation } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/server/auth/request-auth';
import { getOwnedVeoOperation, markVeoSucceeded, resolveVeoApiKey, settleVeoFailure } from '@/server/services/veo-operations';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const operationName = typeof body.operationName === 'string' ? body.operationName : '';
    if (!operationName) {
      return NextResponse.json({ error: 'operationName is required.' }, { status: 400 });
    }

    // Only the user who started the operation may poll or download it.
    const record = await getOwnedVeoOperation(operationName, userId);
    if (!record) {
      return NextResponse.json({ error: 'Video not found.' }, { status: 404 });
    }

    const apiKey = await resolveVeoApiKey(userId, record.usesOwnApiKey);
    if (!apiKey) {
      return NextResponse.json({ error: 'Video generation is not configured.' }, { status: 503 });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });

    const hasVideo = Boolean(updated.response?.generatedVideos?.[0]?.video?.uri);
    if (updated.done) {
      if (updated.error || !hasVideo) await settleVeoFailure(operationName);
      else await markVeoSucceeded(operationName);
    }

    return NextResponse.json({
      done: Boolean(updated.done),
      error: updated.error ? { message: updated.error.message || 'Video generation failed.' } : null,
      hasVideo,
    });
  } catch (err: unknown) {
    console.error('Veo status check error:', err);
    return NextResponse.json({ error: 'Failed to check video status. Please try again.' }, { status: 500 });
  }
}
