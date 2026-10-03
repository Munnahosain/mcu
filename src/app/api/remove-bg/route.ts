import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/server/auth/request-auth";
import { enforceRateLimit } from "@/server/auth/rate-limit";
import { consumeCredits, InsufficientCreditsError, refundCredits } from "@/server/services/credit-service";
import { getFeatureFlagDenial } from "@/server/services/feature-flag-service";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
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

    const rateLimitError = enforceRateLimit(request, userId, {
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

    const apiKey = process.env.POOF_API_KEY || process.env.REMOVE_BG_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "POOF_API_KEY is not configured. Add your Poof.bg key to the server environment." },
        { status: 503 }
      );
    }

    await consumeCredits(userId, 1, "Background removal", "background_removal");
    creditReserved = true;

    const { Poof } = await import("@poof-bg/js");
    const poof = new Poof({ apiKey });

    const result = await poof.removeBackground(imageFile, {
      format: "png",
      size: "full",
    });

    return new NextResponse(result.data, {
      status: 200,
      headers: {
        "Content-Type": result.metadata.contentType || "image/png",
      },
    });
  } catch (error) {
    if (creditReserved && userId) {
      await refundCredits(userId, 1, "Failed background removal refund", "background_removal")
        .catch((refundError) => console.error("[remove-bg] credit refund error:", refundError));
    }
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 402 });
    }
    const message = error instanceof Error ? error.message : "Poof background removal failed";
    console.error("Poof background removal error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
