import { NextResponse } from "next/server";
import { Poof, PoofError } from "@poof-bg/js";
import { getAuthenticatedUserId } from "@/server/auth/request-auth";
import { enforceRateLimit } from "@/server/auth/rate-limit";

const poof = new Poof({
  apiKey: process.env.POOF_API_KEY || process.env.REMOVE_BG_API_KEY || "",
});

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Authentication required to use background remover." }, { status: 401 });
    }

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
      throw new Error("POOF_API_KEY is not configured. Add your Poof.bg key to the server env file.");
    }

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
    const message = error instanceof PoofError
      ? `${error.message} (${error.code})`
      : error instanceof Error
        ? error.message
        : "Poof background removal failed";

    console.error("Poof background removal error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
