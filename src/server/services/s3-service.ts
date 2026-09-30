import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

export type S3Folder = 'assets' | '3d' | 'metadata' | 'backgrounds' | 'avatars' | 'support' | 'exports';

export type PresignedUploadInput = {
  filename: string;
  contentType: string;
  folder?: S3Folder;
  userId: string;
  expiresInSeconds?: number;
  maxSizeBytes?: number;
};

export type PresignedUploadResult = {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
  expiresIn: number;
  bucket: string;
  region: string;
};

let cachedS3Client: S3Client | null = null;

export function getS3Client(): S3Client | null {
  if (cachedS3Client) return cachedS3Client;

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const region = process.env.AWS_REGION?.trim() || 'us-east-1';
  const endpoint = process.env.AWS_S3_ENDPOINT?.trim();

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  cachedS3Client = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
  });

  return cachedS3Client;
}

export function isS3Configured(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
    process.env.AWS_SECRET_ACCESS_KEY?.trim() &&
    process.env.AWS_S3_BUCKET_NAME?.trim()
  );
}

export function getS3ConfigStatus() {
  const isConfigured = isS3Configured();
  return {
    configured: isConfigured,
    bucket: process.env.AWS_S3_BUCKET_NAME?.trim() || '',
    region: process.env.AWS_REGION?.trim() || 'us-east-1',
    endpoint: process.env.AWS_S3_ENDPOINT?.trim() || 'AWS Standard',
    hasCustomDomain: Boolean(process.env.AWS_S3_PUBLIC_DOMAIN?.trim()),
    publicDomain: process.env.AWS_S3_PUBLIC_DOMAIN?.trim() || '',
  };
}

/**
 * Generate a pre-signed URL for direct browser PUT upload to AWS S3
 */
export async function generateUploadPresignedUrl({
  filename,
  contentType,
  folder = 'assets',
  userId,
  expiresInSeconds = 300, // 5 minutes
}: PresignedUploadInput): Promise<PresignedUploadResult> {
  const client = getS3Client();
  const bucket = process.env.AWS_S3_BUCKET_NAME?.trim();
  const region = process.env.AWS_REGION?.trim() || 'us-east-1';
  const customDomain = process.env.AWS_S3_PUBLIC_DOMAIN?.trim();

  if (!client || !bucket) {
    throw new Error('AWS S3 storage is not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME.');
  }

  // Sanitize filename & extension
  const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = cleanFilename.includes('.') ? cleanFilename.split('.').pop() : 'bin';
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(6).toString('hex');
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');

  // S3 object key hierarchy: users/{userId}/{folder}/{timestamp}-{randomId}.{ext}
  const fileKey = `users/${safeUserId}/${folder}/${timestamp}-${randomId}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: fileKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: expiresInSeconds,
  });

  const publicUrl = customDomain
    ? `${customDomain.replace(/\/+$/, '')}/${fileKey}`
    : `https://${bucket}.s3.${region}.amazonaws.com/${fileKey}`;

  return {
    uploadUrl,
    fileKey,
    publicUrl,
    expiresIn: expiresInSeconds,
    bucket,
    region,
  };
}

/**
 * Generate a pre-signed URL for private downloading
 */
export async function generateDownloadPresignedUrl(fileKey: string, expiresInSeconds = 3600): Promise<string> {
  const client = getS3Client();
  const bucket = process.env.AWS_S3_BUCKET_NAME?.trim();

  if (!client || !bucket) {
    throw new Error('AWS S3 storage is not configured.');
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: fileKey,
  });

  return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Delete a file from S3 by fileKey
 */
export async function deleteS3File(fileKey: string): Promise<boolean> {
  const client = getS3Client();
  const bucket = process.env.AWS_S3_BUCKET_NAME?.trim();

  if (!client || !bucket) return false;

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: fileKey,
    });
    await client.send(command);
    return true;
  } catch (error) {
    console.error('Failed to delete S3 file:', error);
    return false;
  }
}
