import { GoogleGenAI, GenerateVideosOperation } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured on the server.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { operationName } = body;

    if (!operationName) {
      return NextResponse.json(
        { error: 'operationName is required for downloading.' },
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

    if (!updated.done) {
      return NextResponse.json(
        { error: 'Video generation is still processing. Please wait.' },
        { status: 202 }
      );
    }

    if (updated.error) {
      return NextResponse.json(
        { error: updated.error.message || 'Video generation reported an error.' },
        { status: 500 }
      );
    }

    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) {
      return NextResponse.json(
        { error: 'Generated video download URI was not returned by model.' },
        { status: 404 }
      );
    }

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
    return new NextResponse(videoBlob, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'inline; filename="veo-animation.mp4"',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: unknown) {
    console.error('Veo download error:', err);
    const message = err instanceof Error ? err.message : String(err || 'Failed to download video.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
