import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured on the server. Please check your API key in project settings.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { prompt, image, aspectRatio = '16:9', resolution = '720p' } = body;

    if (!prompt && !image) {
      return NextResponse.json(
        { error: 'Please provide either a prompt or an image to animate.' },
        { status: 400 }
      );
    }

    const validAspectRatios = ['16:9', '9:16'];
    const selectedAspectRatio = validAspectRatios.includes(aspectRatio) ? aspectRatio : '16:9';

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    let imagePayload: { imageBytes: string; mimeType: string } | undefined = undefined;
    if (image && typeof image === 'string') {
      let base64Data = image;
      let mimeType = 'image/png';
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
      imagePayload = {
        imageBytes: base64Data,
        mimeType,
      };
    }

    const videoConfig = {
      numberOfVideos: 1,
      resolution: resolution === '1080p' ? '1080p' : '720p',
      aspectRatio: selectedAspectRatio as '16:9' | '9:16',
    };

    // Use veo-3.1-fast-generate-preview per requirement
    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt || (imagePayload ? 'Animate this visual with smooth natural motion' : 'Cinematic motion graphic'),
      ...(imagePayload ? { image: imagePayload } : {}),
      config: videoConfig,
    });

    return NextResponse.json({
      operationName: operation.name,
      model: 'veo-3.1-fast-generate-preview',
      aspectRatio: selectedAspectRatio,
    });
  } catch (err: unknown) {
    console.error('Veo video generation error:', err);
    const message = err instanceof Error ? err.message : String(err || 'Failed to start video generation.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
