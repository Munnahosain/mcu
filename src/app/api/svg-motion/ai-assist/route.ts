import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/server/auth/request-auth';
import { enforceRateLimit } from '@/server/auth/rate-limit';
import { resolveUserApiKey } from '@/server/services/vision-service';
import { consumeCredits, InsufficientCreditsError, refundCredits } from '@/server/services/credit-service';
import { getFeatureFlagDenial } from '@/server/services/feature-flag-service';
import { AnimationPlanJson, AnimationTarget, planJson, validateAnimationPlan } from '@/components/SvgMotionStudio/animationPlan';

export const maxDuration = 60;

const MAX_BODY_BYTES = 120_000;
const MAX_ELEMENTS = 80;
const MAX_DEFINITIONS = 32;
const ALLOWED_PROPERTIES = [
  'x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity', 'skewX', 'skewY',
  'fill', 'stroke', 'strokeWidth', 'strokeDashoffset', 'originX', 'originY', 'transform',
];

interface RequestElement {
  id: string;
  originalId?: string;
  name: string;
  tag: string;
}

interface AnimationRequest {
  prompt: string;
  context: {
    elementCount: number;
    elements: RequestElement[];
    definitions?: Array<{ id: string | null; type: string; children: number; attributes?: Record<string, string>; stops?: string[]; filterPrimitives?: string[] }>;
  };
  duration: number;
  fps: number;
  loop: boolean;
  stockMotion: boolean;
  mode: 'generate' | 'modify';
  existingPlan?: AnimationPlanJson;
  avoidPlan?: AnimationPlanJson;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Gemini returned an invalid animation plan. Please regenerate.');
    return JSON.parse(match[0]);
  }
}

function getProviderError(error: unknown): { message: string; status: number } {
  const raw = error instanceof Error ? error.message : String(error || '');
  const lower = raw.toLowerCase();
  const providerStatus = typeof error === 'object' && error
    ? ('status' in error ? error.status : 'statusCode' in error ? error.statusCode : undefined)
    : undefined;
  const status = Number(providerStatus) || 0;
  if (status === 429 || lower.includes('rate limit') || lower.includes('quota')) {
    return { message: 'Gemini rate limit reached. Please wait a moment and retry.', status: 429 };
  }
  if (status === 401 || lower.includes('api key') || lower.includes('unauthorized')) {
    return { message: 'Gemini API key is invalid or does not have model access. Check the key in Settings.', status: 401 };
  }
  if (status === 403 || lower.includes('permission denied') || lower.includes('permission_denied')) {
    return { message: 'Gemini denied this request. Check that your API key and Google account have access to Gemini API.', status: 403 };
  }
  if (status === 404 || lower.includes('model not found') || lower.includes('not found for api version')) {
    return { message: 'The configured Gemini model is unavailable for this API key. Check the model access and try again.', status: 502 };
  }
  if (lower.includes('timeout') || lower.includes('aborted')) {
    return { message: 'Gemini timed out while planning the animation. Please retry.', status: 504 };
  }
  if (status === 400 || lower.includes('invalid argument') || lower.includes('invalid request')) {
    return { message: 'Gemini rejected the animation request. Try a shorter prompt or a simpler SVG, then retry.', status: 422 };
  }
  if (status >= 500 || lower.includes('fetch failed') || lower.includes('econnreset')) {
    return { message: 'Gemini is temporarily unavailable. Please wait a moment and retry.', status: 503 };
  }
  console.error('SVG animation assistant provider failure:', { status, message: raw.slice(0, 300) });
  return { message: 'Gemini could not create an animation plan. Please retry.', status: 502 };
}

export async function POST(req: NextRequest) {
  let userId: string | null = null;
  let creditReserved = false;
  let usesOwnApiKey = false;
  try {
    userId = await getAuthenticatedUserId(req);
    if (!userId) return errorResponse('Authentication required to generate an animation plan.', 401);
    const featureDenial = await getFeatureFlagDenial(userId, 'ai_tools', 'AI generation');
    if (featureDenial) return errorResponse(featureDenial, 403);
    const operationDenial = await getFeatureFlagDenial(userId, 'svg_motion', 'SVG Motion AI');
    if (operationDenial) return errorResponse(operationDenial, 403);
    const rateLimitError = enforceRateLimit(req, userId, {
      limit: 12,
      windowMs: 60 * 1000,
      keyPrefix: 'svg-motion-ai',
    });
    if (rateLimitError) return rateLimitError;

    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) return errorResponse('SVG analysis context is too large. Please simplify the uploaded SVG.', 413);

    let body: AnimationRequest;
    try {
      body = await req.json() as AnimationRequest;
    } catch {
      return errorResponse('Request body must be valid JSON.', 400);
    }

    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) return errorResponse('Enter a motion prompt first.', 400);
    if (prompt.length > 1200) return errorResponse('Prompt must be 1,200 characters or fewer.', 400);
    if (!body.context || !Array.isArray(body.context.elements) || body.context.elements.length === 0) {
      return errorResponse('Upload an SVG with at least one supported vector element first.', 400);
    }
    if (body.context.elements.length > MAX_ELEMENTS || (body.context.definitions?.length ?? 0) > MAX_DEFINITIONS) {
      return errorResponse('This SVG has too many elements for one animation request. Try simplifying or grouping the artwork.', 413);
    }

    const duration = Number(body.duration);
    const fps = Number(body.fps);
    if (!Number.isFinite(duration) || duration < 1 || duration > 30) return errorResponse('Duration must be between 1 and 30 seconds.', 400);
    if (![12, 24, 30, 60].includes(fps)) return errorResponse('Frame rate must be 12, 24, 30, or 60 FPS.', 400);

    const targets: AnimationTarget[] = body.context.elements.map((element) => ({
      id: element.id,
      originalId: element.originalId || undefined,
      name: element.name,
    }));

    const storedGeminiKey = userId ? await resolveUserApiKey(userId, 'Google Gemini') : null;
    usesOwnApiKey = Boolean(storedGeminiKey);
    const effectiveApiKey = storedGeminiKey?.apiKey || process.env.GEMINI_API_KEY?.trim();
    if (!effectiveApiKey) {
      return errorResponse('Add a Google Gemini API key in Settings or configure GEMINI_API_KEY on the server.', 503);
    }
    await consumeCredits(userId, 1, 'SVG motion AI plan generation', 'svg_motion', { usesOwnApiKey });
    creditReserved = true;

    const stockRules = body.stockMotion
      ? 'Stock Motion mode is ON: preserve the source composition, use controlled premium commercial movement, keep loops seamless, avoid chaos, random jitter, excessive deformation, and unnecessary motion.'
      : 'Keep motion intentional and preserve the source artwork. Avoid random or excessive movement.';
    const modifyRules = body.mode === 'modify' && body.existingPlan
      ? `Modify the supplied existing plan according to the new instruction. Preserve its duration and all unrelated animations unless the user explicitly asks to change them. Existing plan JSON:\n${JSON.stringify(body.existingPlan)}`
      : 'Create an animation plan from the prompt and SVG metadata.';
    const variationRules = body.mode === 'generate' && body.avoidPlan
      ? `This is a regeneration. Create a meaningfully different choreography: change the animated targets, properties, timing, amplitude, or easing as appropriate to the prompt. Do not copy this previous plan pattern:\n${JSON.stringify(body.avoidPlan)}`
      : 'Choose properties and timing that directly match the user instruction and each element shape; avoid applying one repeated generic transform to every layer.';

    const systemInstruction = `You are a professional motion designer for abstract SVG stock backgrounds, decorative vectors, geometry, gradients, waves, lines, circles, patterns, and technology graphics. Never create character, human, animal, body-part, facial, walking, waving, or talking animation. Return only structured JSON matching the response schema. Do not output JavaScript or prose outside JSON.

Plan rules:
- Use only target IDs present in the supplied SVG element list.
- Select motion properties that fit each target's tag, bounds, style, and hierarchy.
- Keep the original composition recognizable; use subtle, premium movement by default.
- Use x/y/rotation/scaleX/scaleY/opacity/skewX/skewY/fill/stroke/strokeWidth/strokeDashoffset/originX/originY, or a structured transform object with numeric components.
- Keep values within sensible screen-space bounds; opacity is 0-100 and scale is 0-400.
- Duration is ${duration} seconds, FPS is ${fps}, and loop is ${Boolean(body.loop)}. Honor these settings.
- When looping, every animated property's first and last values must match at time 0 and duration; a full-turn rotation may end at an equivalent multiple of 360 degrees.
- Return 2-12 useful keyframes per animated property, sorted by time, with times from 0 through duration.
- Keep the plan compact: animate only useful elements, not every layer by default.
- Vary animation trajectories and target assignments according to the exact prompt; do not default to the same scale-and-translate loop.
${stockRules}`;

    const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: JSON.stringify({
        task: body.mode === 'modify' ? 'refine_animation_plan' : 'create_animation_plan',
        userInstruction: prompt,
        requestedSettings: { duration, fps, loop: Boolean(body.loop), stockMotion: Boolean(body.stockMotion) },
        modification: modifyRules,
        variation: variationRules,
        svg: {
          elementCount: body.context.elementCount,
          elements: body.context.elements,
          definitions: body.context.definitions ?? [],
        },
      }),
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            duration: { type: Type.NUMBER },
            fps: { type: Type.INTEGER },
            loop: { type: Type.BOOLEAN },
            description: { type: Type.STRING },
            animations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  target: { type: Type.STRING },
                  property: { type: Type.STRING, enum: ALLOWED_PROPERTIES },
                  easing: { type: Type.STRING, enum: ['linear', 'easeIn', 'easeOut', 'easeInOut', 'backIn', 'backOut', 'backInOut', 'elasticOut', 'bounceOut', 'custom'] },
                  keyframes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        time: { type: Type.NUMBER },
                        value: {
                          anyOf: [
                            { type: Type.NUMBER },
                            { type: Type.STRING },
                            {
                              type: Type.OBJECT,
                              properties: Object.fromEntries(['x', 'y', 'rotation', 'scaleX', 'scaleY', 'skewX', 'skewY', 'opacity'].map((key) => [key, { type: Type.NUMBER }])),
                            },
                          ],
                        },
                      },
                      required: ['time', 'value'],
                    },
                  },
                },
                required: ['target', 'property', 'keyframes'],
              },
            },
          },
          required: ['duration', 'fps', 'loop', 'description', 'animations'],
        },
        temperature: 0.78,
        topP: 0.92,
        maxOutputTokens: 4096,
      },
    });

    const rawPlan = extractJson(response.text || '');
    const validated = validateAnimationPlan(rawPlan, targets, prompt);
    return NextResponse.json({ success: true, plan: planJson(validated) });
  } catch (error) {
    if (creditReserved && userId) {
      await refundCredits(userId, 1, 'Failed SVG motion AI plan refund', 'svg_motion', { usesOwnApiKey })
        .catch((refundError) => console.error('[svg-motion-ai] credit refund error:', refundError));
    }
    if (error instanceof InsufficientCreditsError) {
      return errorResponse(error.message, 402);
    }
    if (error instanceof Error && error.message.includes('unavailable SVG element')) {
      return errorResponse(error.message, 422);
    }
    if (error instanceof Error && /animation|keyframe|duration|frame rate|transform|property|color|target/i.test(error.message)) {
      return errorResponse(error.message, 422);
    }
    const providerError = getProviderError(error);
    return errorResponse(providerError.message, providerError.status);
  }
}
