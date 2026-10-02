import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60;

interface ElementSummary {
  id: string;
  name: string;
  tag: string;
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      try {
        const text = await req.text();
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {};
      }
    }

    const {
      prompt = '',
      elements = [] as ElementSummary[],
      characterSlots = {},
      selectedElementId = null,
      duration = 4.0,
      apiKey: customApiKey,
      provider: customProvider,
    } = body;

    const trimmedPrompt = (prompt || '').trim();
    if (!trimmedPrompt) {
      return NextResponse.json({ error: 'Please provide an animation prompt.' }, { status: 400 });
    }

    const dur = Math.max(1, Math.min(30, Number(duration) || 4.0));
    const effectiveApiKey = customApiKey?.trim() || process.env.GEMINI_API_KEY?.trim();

    // 1. If Gemini API key is available, use GoogleGenAI to generate intelligent keyframes
    if (effectiveApiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
        const systemInstruction = `You are an expert SVG motion animator and After Effects motion designer.
Given a list of SVG elements and a prompt describing the desired animation, generate smooth, professional keyframe tracks.
Available properties: "scaleX", "scaleY", "rotation", "opacity", "x", "y".
Scale is 0-200 (100 is normal). Opacity is 0-100 (100 is solid). Rotation is in degrees (-360 to +360). Position x and y are in pixels (-300 to +300).
Supported easings: "easeInOut", "easeOut", "easeIn", "linear", "bounceOut", "backOut", "elasticOut".
Always loop smoothly by matching the first keyframe (time: 0) with the last keyframe (time: ${dur}).
Return ONLY valid JSON matching this schema:
{
  "summary": ["step 1", "step 2"],
  "duration": ${dur},
  "loop": true,
  "tracks": [
    {
      "id": "trk_1",
      "elementId": "ELEMENT_ID_FROM_LIST",
      "property": "rotation",
      "keyframes": [
        { "id": "kf_1", "time": 0, "value": 0, "easing": "easeInOut" },
        { "id": "kf_2", "time": 2, "value": 15, "easing": "easeInOut" },
        { "id": "kf_3", "time": 4, "value": 0, "easing": "easeInOut" }
      ]
    }
  ]
}`;

        const promptText = `User Prompt: "${trimmedPrompt}"
Duration: ${dur} seconds
Selected Element ID: ${selectedElementId || 'none'}
Character Slots: ${JSON.stringify(characterSlots)}
Available Elements: ${JSON.stringify(elements.slice(0, 50))}`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: promptText,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });

        const textOutput = response.text || '';
        const parsed = JSON.parse(textOutput);
        if (parsed && Array.isArray(parsed.tracks) && parsed.tracks.length > 0) {
          return NextResponse.json({
            success: true,
            summary: parsed.summary || ['Generated motion with Gemini AI'],
            duration: parsed.duration || dur,
            loop: parsed.loop ?? true,
            tracks: parsed.tracks,
          });
        }
      } catch (geminiError: any) {
        console.warn('Gemini motion generation error, falling back to smart procedural planner:', geminiError?.message);
      }
    }

    // 2. Procedural Motion Engine Fallback (handles all common animation requests seamlessly)
    const p = trimmedPrompt.toLowerCase();
    const targetId = selectedElementId || (characterSlots as any).body || elements[0]?.id || 'target';
    const tracks: any[] = [];
    const summary: string[] = [];

    const makeKf = (time: number, value: number, easing = 'easeInOut') => ({
      id: `kf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      time,
      value,
      easing,
    });

    if (p.includes('breath') || p.includes('chest') || p.includes('pulse') || p.includes('heartbeat')) {
      summary.push('Gentle organic breathing & pulse cycle');
      tracks.push({
        id: `trk_${Date.now()}_scaleY`,
        elementId: targetId,
        property: 'scaleY',
        keyframes: [
          makeKf(0, 100, 'easeInOut'),
          makeKf(dur / 2, 106, 'easeInOut'),
          makeKf(dur, 100, 'easeInOut'),
        ],
      });
      tracks.push({
        id: `trk_${Date.now()}_scaleX`,
        elementId: targetId,
        property: 'scaleX',
        keyframes: [
          makeKf(0, 100, 'easeInOut'),
          makeKf(dur / 2, 98, 'easeInOut'),
          makeKf(dur, 100, 'easeInOut'),
        ],
      });
    } else if (p.includes('bounce') || p.includes('jump') || p.includes('hop')) {
      summary.push('High-energy spring bounce animation');
      tracks.push({
        id: `trk_${Date.now()}_y`,
        elementId: targetId,
        property: 'y',
        keyframes: [
          makeKf(0, 0, 'easeOut'),
          makeKf(dur * 0.35, -50, 'easeIn'),
          makeKf(dur * 0.7, 0, 'bounceOut'),
          makeKf(dur, 0, 'easeInOut'),
        ],
      });
      tracks.push({
        id: `trk_${Date.now()}_scaleY`,
        elementId: targetId,
        property: 'scaleY',
        keyframes: [
          makeKf(0, 100, 'easeInOut'),
          makeKf(dur * 0.35, 115, 'easeInOut'),
          makeKf(dur * 0.7, 85, 'bounceOut'),
          makeKf(dur, 100, 'easeInOut'),
        ],
      });
    } else if (p.includes('spin') || p.includes('rotate') || p.includes('turn')) {
      summary.push('360 degree rotation with smooth easing');
      tracks.push({
        id: `trk_${Date.now()}_rot`,
        elementId: targetId,
        property: 'rotation',
        keyframes: [
          makeKf(0, 0, 'easeInOut'),
          makeKf(dur, 360, 'easeInOut'),
        ],
      });
    } else if (p.includes('fade') || p.includes('opacity') || p.includes('ghost')) {
      summary.push('Smooth opacity fade in and out');
      tracks.push({
        id: `trk_${Date.now()}_opac`,
        elementId: targetId,
        property: 'opacity',
        keyframes: [
          makeKf(0, 100, 'easeInOut'),
          makeKf(dur / 2, 20, 'easeInOut'),
          makeKf(dur, 100, 'easeInOut'),
        ],
      });
    } else if (p.includes('float') || p.includes('hover') || p.includes('levitate')) {
      summary.push('Gentle levitating float loop');
      tracks.push({
        id: `trk_${Date.now()}_floatY`,
        elementId: targetId,
        property: 'y',
        keyframes: [
          makeKf(0, 0, 'easeInOut'),
          makeKf(dur / 2, -25, 'easeInOut'),
          makeKf(dur, 0, 'easeInOut'),
        ],
      });
      tracks.push({
        id: `trk_${Date.now()}_floatRot`,
        elementId: targetId,
        property: 'rotation',
        keyframes: [
          makeKf(0, -2, 'easeInOut'),
          makeKf(dur / 2, 2, 'easeInOut'),
          makeKf(dur, -2, 'easeInOut'),
        ],
      });
    } else if (p.includes('wave') || p.includes('swing') || p.includes('flutter')) {
      summary.push('Oscillating swing and flutter motion');
      tracks.push({
        id: `trk_${Date.now()}_swing`,
        elementId: targetId,
        property: 'rotation',
        keyframes: [
          makeKf(0, 0, 'easeInOut'),
          makeKf(dur * 0.25, 20, 'easeInOut'),
          makeKf(dur * 0.75, -20, 'easeInOut'),
          makeKf(dur, 0, 'easeInOut'),
        ],
      });
    } else {
      // General dynamic pop & bounce
      summary.push(`Created custom ${dur}s motion cycle based on prompt`);
      tracks.push({
        id: `trk_${Date.now()}_scaleX`,
        elementId: targetId,
        property: 'scaleX',
        keyframes: [
          makeKf(0, 100, 'easeInOut'),
          makeKf(dur * 0.4, 112, 'backOut'),
          makeKf(dur, 100, 'easeInOut'),
        ],
      });
      tracks.push({
        id: `trk_${Date.now()}_scaleY`,
        elementId: targetId,
        property: 'scaleY',
        keyframes: [
          makeKf(0, 100, 'easeInOut'),
          makeKf(dur * 0.4, 112, 'backOut'),
          makeKf(dur, 100, 'easeInOut'),
        ],
      });
      tracks.push({
        id: `trk_${Date.now()}_y`,
        elementId: targetId,
        property: 'y',
        keyframes: [
          makeKf(0, 0, 'easeInOut'),
          makeKf(dur * 0.5, -15, 'easeInOut'),
          makeKf(dur, 0, 'easeInOut'),
        ],
      });
    }

    return NextResponse.json({
      success: true,
      summary,
      duration: dur,
      loop: true,
      tracks,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to process AI animation request' },
      { status: 500 }
    );
  }
}
