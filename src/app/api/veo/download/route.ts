import { GoogleGenAI, GenerateVideosOperation } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/server/auth/request-auth';
import { getOwnedVeoOperation, markVeoSucceeded, resolveVeoApiKey, settleVeoFailure } from '@/server/services/veo-operations';

export const maxDuration = 120;

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

    if (!updated.done) {
      return NextResponse.json(
        { error: 'Video generation is still processing. Please wait.' },
        { status: 202 }
      );
    }

    if (updated.error) {
      await settleVeoFailure(operationName);
      return NextResponse.json(
        { error: updated.error.message || 'Video generation reported an error.' },
        { status: 500 }
      );
    }

    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) {
      await settleVeoFailure(operationName);
      return NextResponse.json(
        { error: 'Generated video download URI was not returned by model.' },
        { status: 404 }
      );
    }

    // Key goes in the header only, never in the URL (URLs end up in logs).
    const videoRes = await fetch(uri, {
      headers: { 'x-goog-api-key': apiKey },
    });

    if (!videoRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch video stream from Google storage: ${videoRes.statusText}` },
        { status: videoRes.status }
      );
    }

    const videoBlob = await videoRes.blob();
    await markVeoSucceeded(operationName);
    return new NextResponse(videoBlob, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'inline; filename="veo-animation.mp4"',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err: unknown) {
    console.error('Veo download error:', err);
    return NextResponse.json({ error: 'Failed to download video. Please try again.' }, { status: 500 });
  }
}
