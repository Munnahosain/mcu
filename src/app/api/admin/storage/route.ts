import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { getS3ConfigStatus, generateUploadPresignedUrl, isS3Configured } from '@/server/services/s3-service';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const status = getS3ConfigStatus();
    return NextResponse.json({
      success: true,
      status,
      envGuide: {
        required: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_BUCKET_NAME'],
        optional: ['AWS_REGION', 'AWS_S3_ENDPOINT', 'AWS_S3_PUBLIC_DOMAIN'],
      },
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!isS3Configured()) {
      return NextResponse.json(
        { success: false, error: 'AWS S3 environment variables are not set in .env' },
        { status: 400 }
      );
    }

    // Test generating a presigned test URL
    const testResult = await generateUploadPresignedUrl({
      filename: 'test-connection.png',
      contentType: 'image/png',
      folder: 'assets',
      userId: String(admin._id),
      expiresInSeconds: 120,
    });

    return NextResponse.json({
      success: true,
      message: 'AWS S3 Pre-Signed URL generated successfully!',
      testResult,
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
