import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, authorizationErrorResponse } from '@/server/auth/authorization';
import { generateUploadPresignedUrl, isS3Configured, S3Folder } from '@/server/services/s3-service';
import { enforceRateLimit } from '@/server/auth/rate-limit';

const ALLOWED_CONTENT_TYPES = new Set([
  // Images
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/gif',
  'image/tiff',
  'image/avif',
  // 3D & Vector Assets
  'model/gltf-binary',
  'model/gltf+json',
  'application/octet-stream',
  // Data / Metadata
  'application/json',
  'text/csv',
  'text/plain',
  // Video (if studio animations exported)
  'video/mp4',
  'video/webm',
]);

const ALLOWED_FOLDERS: Set<S3Folder> = new Set([
  'assets',
  '3d',
  'metadata',
  'backgrounds',
  'avatars',
  'support',
  'exports',
]);

export async function POST(req: Request) {
  try {
    const user = await requireAuthenticatedUser(req);

    // Rate limit: max 60 presigned URL requests per minute per user
    const rateLimitError = enforceRateLimit(req, String(user._id), {
      limit: 60,
      windowMs: 60 * 1000,
      keyPrefix: 'storage-presigned-url',
    });
    if (rateLimitError) return rateLimitError;

    if (!isS3Configured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'AWS S3 Cloud Storage is not configured by the admin yet.',
          code: 'S3_NOT_CONFIGURED',
        },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const filename = typeof body.filename === 'string' ? body.filename.trim() : '';
    const contentType = typeof body.contentType === 'string' ? body.contentType.trim().toLowerCase() : '';
    const folderInput = typeof body.folder === 'string' ? body.folder.trim().toLowerCase() : 'assets';
    const folder: S3Folder = ALLOWED_FOLDERS.has(folderInput as S3Folder)
      ? (folderInput as S3Folder)
      : 'assets';

    if (!filename || filename.length > 255) {
      return NextResponse.json(
        { success: false, error: 'A valid filename is required (max 255 characters).' },
        { status: 400 }
      );
    }

    if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Content-Type '${contentType}' is not supported. Supported types: images, SVGs, GLTF 3D models, CSV, JSON, MP4.`,
        },
        { status: 400 }
      );
    }

    const presignedData = await generateUploadPresignedUrl({
      filename,
      contentType,
      folder,
      userId: String(user._id),
      expiresInSeconds: 300, // 5 minutes
    });

    return NextResponse.json({
      success: true,
      ...presignedData,
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
