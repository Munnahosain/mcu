import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/server/auth/request-auth";
import { enforceRateLimit } from "@/server/auth/rate-limit";

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
    const imageFile = formData.get("image") as File;

    if (!imageFile) {
      return NextResponse.json({ success: false, error: "No image file provided" }, { status: 400 });
    }

    // Prepare FormData for remove.bg API
    const bgFormData = new FormData();
    bgFormData.append("image_file", imageFile);
    bgFormData.append("size", "auto");
    bgFormData.append("format", "png");

    // Call remove.bg API using environment variable API key
    const apiKey = process.env.REMOVE_BG_API_KEY || process.env.BG_REMOVER_API || process.env.BG_REMOVER_API_KEY;
    if (!apiKey) {
      throw new Error("Remove.bg API key is not configured. Please set REMOVE_BG_API_KEY or BG_REMOVER_API in your .env file.");
    }
    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
      },
      body: bgFormData,
    });

    if (!response.ok) {
        let errorDetails = "";
        try {
            const errorObj = await response.json();
            errorDetails = errorObj.errors ? errorObj.errors[0].title : "API Error";
        } catch {
            errorDetails = response.statusText;
        }
        throw new Error(`remove.bg failed: ${response.status} ${errorDetails}`);
    }

    const imageBlob = await response.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
      },
    });

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Background Removal Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Something went wrong" }, { status: 500 });
  }
}
