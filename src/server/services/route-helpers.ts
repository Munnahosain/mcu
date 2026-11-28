import { NextResponse } from 'next/server';
import { getFriendlyProviderMessage, getStatusCode, isProviderKeyError } from '@/server/services/vision-service';

const RASTER_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'avif', 'heic', 'heif'];
const VECTOR_EXTENSIONS = ['svg', 'eps', 'ai', 'pdf'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'm4v'];

export const MAX_RASTER_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_VECTOR_UPLOAD_BYTES = 25 * 1024 * 1024;

function extensionOf(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
}

/**
 * Accepts images, vector files (svg/eps/ai/pdf) and video frames (the client sends a JPEG contact sheet).
 * Returns an error response, or null when the file is fine.
 */
export function validateImageUpload(file: unknown, options: { allowVector?: boolean; allowVideo?: boolean } = {}): NextResponse | null {
  const allowVector = options.allowVector ?? true;
  const allowVideo = options.allowVideo ?? true;
  if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
    return NextResponse.json({ success: false, error: 'No image provided.' }, { status: 400 });
  }
  const upload = file as File;
  const ext = extensionOf(upload.name || '');
  const type = (upload.type || '').toLowerCase();

  const isVector = VECTOR_EXTENSIONS.includes(ext) || type === 'image/svg+xml' || type === 'application/postscript' || type === 'application/pdf' || type === 'application/illustrator';
  const isRaster = type.startsWith('image/') || RASTER_EXTENSIONS.includes(ext);
  const isVideoFrame = type.startsWith('video/') || VIDEO_EXTENSIONS.includes(ext);

  if (isVector && !allowVector) {
    return NextResponse.json({ success: false, error: 'Unsupported image. Use JPG, PNG or WebP.', code: 'UNSUPPORTED_IMAGE' }, { status: 422 });
  }
  if (isVideoFrame && !isRaster && !allowVideo) {
    return NextResponse.json({ success: false, error: 'Unsupported image. Video files are not supported here.', code: 'UNSUPPORTED_IMAGE' }, { status: 422 });
  }
  if (!isVector && !isRaster && !isVideoFrame) {
    return NextResponse.json({ success: false, error: 'Unsupported image. Upload an image, SVG, EPS or AI file.', code: 'UNSUPPORTED_IMAGE' }, { status: 422 });
  }
  const limit = isVector ? MAX_VECTOR_UPLOAD_BYTES : MAX_RASTER_UPLOAD_BYTES;
  if (upload.size > limit) {
    return NextResponse.json({
      success: false,
      error: `File is too large. Maximum is ${Math.round(limit / 1024 / 1024)} MB.`,
      code: 'FILE_TOO_LARGE',
    }, { status: 413 });
  }
  if (upload.size === 0) {
    return NextResponse.json({ success: false, error: 'The file is empty.', code: 'UNSUPPORTED_IMAGE' }, { status: 422 });
  }
  return null;
}

export class UnsupportedImageError extends Error {
  status = 422;
  code = 'UNSUPPORTED_IMAGE';
  constructor(message = 'Unsupported image. The file could not be read as an image.') {
    super(message);
  }
}

/** Runs an image-processing step (sharp etc.) and turns decoder failures into a 422. */
export async function withImageDecode<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.warn('[upload] image decode failed:', error instanceof Error ? error.message : error);
    throw new UnsupportedImageError();
  }
}

/**
 * Error response for AI-provider failures. A provider rejecting the user's key is a 422
 * (PROVIDER_KEY_INVALID) — 401 is reserved for our own session so the app does not log the user out.
 */
export function providerErrorResponse(error: unknown) {
  if (error instanceof UnsupportedImageError) {
    return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: 422 });
  }
  if (isProviderKeyError(error)) {
    return NextResponse.json({
      success: false,
      error: 'The AI provider rejected your API key. Check or replace it in Settings.',
      code: 'PROVIDER_KEY_INVALID',
    }, { status: 422 });
  }
  let status = getStatusCode(error) || 500;
  if (status === 401 || status === 403) status = 422;
  if (status < 400 || status > 599) status = 500;
  return NextResponse.json({ success: false, error: getFriendlyProviderMessage(error) }, { status });
}
