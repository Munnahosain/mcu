import { GoogleGenAI, GenerateVideosOperation } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/server/auth/request-auth';
import { resolveUserApiKey } from '@/server/services/vision-service';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const storedGeminiKey = await resolveUserApiKey(userId, 'Google Gemini');
    const apiKey = storedGeminiKey?.apiKey || process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { operationName } = body;

    if (!operationName) {
      return NextResponse.json(
        { error: 'operationName is required for polling status.' },
        { status: 400 }
      );
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

    return NextResponse.json({
      done: Boolean(updated.done),
      error: updated.error ? { message: updated.error.message || 'Video generation failed.' } : null,
      hasVideo,
    });
  } catch (err: unknown) {
    console.error('Veo status check error:', err);
    const message = err instanceof Error ? err.message : String(err || 'Failed to poll video generation status.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
