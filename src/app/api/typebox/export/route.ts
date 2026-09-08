import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { svgContent, format = "png", scale = 1, width, height } = body;

    if (!svgContent) {
      return NextResponse.json({ error: "Missing SVG content" }, { status: 400 });
    }

    const svgBuffer = Buffer.from(svgContent, "utf-8");

    if (format === "svg") {
      return new NextResponse(svgContent, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Content-Disposition": `attachment; filename="typebox-graphic.svg"`,
        },
      });
    }

    const density = Math.min(600, Math.round(72 * (scale || 1)));
    let pipeline = sharp(svgBuffer, { density });

    if (width && height) {
      pipeline = pipeline.resize(Math.round(width * scale), Math.round(height * scale), {
        fit: "fill",
      });
    }

    if (format === "webp") {
      const buffer = await pipeline.webp({ quality: 100 }).toBuffer();
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "image/webp",
          "Content-Disposition": `attachment; filename="typebox-graphic.webp"`,
        },
      });
    }

    // Default PNG
    const buffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="typebox-graphic.png"`,
      },
    });
  } catch (error) {
    console.error("Typebox export API error:", error);
    return NextResponse.json(
      { error: "Failed to render export: " + (error instanceof Error ? error.message : "Unknown error") },
      { status: 500 }
    );
  }
}
