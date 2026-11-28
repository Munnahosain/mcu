import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/server/auth/request-auth";
import { enforceRateLimit } from "@/server/auth/rate-limit";
import { consumeCredits, InsufficientCreditsError, refundCredits, type CreditReceipt } from "@/server/services/credit-service";
import { getFeatureFlagDenial } from "@/server/services/feature-flag-service";
import { validateImageUpload } from "@/server/services/route-helpers";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let creditReceipt: CreditReceipt | null = null;
  let userId: string | null = null;
  let creditReserved = false;
  try {
    userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Authentication required to use background remover." }, { status: 401 });
    }
    const aiFeatureDenial = await getFeatureFlagDenial(userId, "ai_tools", "AI tools");
    if (aiFeatureDenial) return NextResponse.json({ success: false, error: aiFeatureDenial }, { status: 403 });
    const bgFeatureDenial = await getFeatureFlagDenial(userId, "background_removal", "Background removal", "bg_remover");
    if (bgFeatureDenial) return NextResponse.json({ success: false, error: bgFeatureDenial }, { status: 403 });

    const rateLimitError = await enforceRateLimit(request, userId, {
      limit: 5,
      windowMs: 60 * 1000,
      keyPrefix: "remove-bg",
    });
    if (rateLimitError) return rateLimitError;

    const formData = await request.formData();
    const imageFile = formData.get("image");

    if (!imageFile || !(imageFile instanceof File)) {
      return NextResponse.json({ success: false, error: "No image file provided" }, { status: 400 });
    }
    const uploadError = validateImageUpload(imageFile, { allowVector: false, allowVideo: false });
    if (uploadError) return uploadError;

    const apiKey =
      process.env.POOF_API_KEY ||
      process.env.REMOVE_BG_API_KEY ||
      process.env.BG_Remover_API ||
      process.env.BG_REMOVER_API;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "POOF_API_KEY is not configured. Add your Poof.bg key (or BG_Remover_API) to the server environment." },
        { status: 503 }
      );
    }

    creditReceipt = (await consumeCredits(userId, 1, "Background removal", "background_removal")).receipt;
    creditReserved = true;

    const { Poof } = await import("@poof-bg/js");
    const poof = new Poof({ apiKey });

    const result = await poof.removeBackground(imageFile, {
      format: "png",
      size: "full",
    });

    // Images come back as bytes; a Job is only returned for video, which this route does not accept.
    if (!("data" in result)) {
      throw Object.assign(new Error("Background removal returned a processing job instead of an image."), { status: 502 });
    }

    return new NextResponse(result.data, {
      status: 200,
      headers: {
        "Content-Type": result.metadata.contentType || "image/png",
      },
    });
  } catch (error) {
    if (creditReserved && userId) {
      await refundCredits(userId, creditReceipt ?? 1, "Failed background removal refund", "background_removal")
        .catch((refundError) => console.error("[remove-bg] credit refund error:", refundError));
    }
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 402 });
    }
    console.error("Poof background removal error:", error);
    const name = error instanceof Error ? error.name : "";
    const status = name === "ValidationError"
      ? 422
      : name === "RateLimitError"
        ? 429
        : typeof (error as { status?: unknown })?.status === "number"
          ? Number((error as { status: number }).status)
          : 500;
    const message = status === 422
      ? "Unsupported image. Use a JPG, PNG or WebP file."
      : status === 429
        ? "Background removal is busy. Please try again in a moment."
        : "Background removal failed. Please try again.";
    return NextResponse.json({ success: false, error: message }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}
