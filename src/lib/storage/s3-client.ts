/**
 * S3 Client-side Uploader using Pre-Signed URLs
 */

import { ensureAccessToken } from "@/lib/auth";

export type S3UploadOptions = {
  folder?: 'assets' | '3d' | 'metadata' | 'backgrounds' | 'avatars' | 'support' | 'exports';
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
};

export type S3UploadResponse = {
  success: boolean;
  fileKey: string;
  publicUrl: string;
  error?: string;
};

/**
 * Upload any File or Blob directly to AWS S3 using a Pre-Signed PUT URL
 */
export async function uploadFileToS3(
  file: File | Blob,
  filename: string,
  options: S3UploadOptions = {}
): Promise<S3UploadResponse> {
  const { folder = 'assets', onProgress, signal } = options;
  const contentType = file.type || 'application/octet-stream';

  try {
    // 1. Get Pre-Signed URL from Backend
    const token = await ensureAccessToken();
    const presignRes = await fetch('/api/storage/presigned-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        filename,
        contentType,
        folder,
      }),
      signal,
    });

    const presignData = await presignRes.json();
    if (!presignRes.ok || !presignData.success) {
      throw new Error(presignData.error || 'Failed to generate S3 pre-signed upload URL.');
    }

    const { uploadUrl, fileKey, publicUrl } = presignData;

    // 2. Direct PUT Upload to AWS S3 via XMLHttpRequest for live progress reporting
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', contentType);

      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (onProgress) onProgress(100);
          resolve();
        } else {
          reject(new Error(`S3 upload failed with status ${xhr.status} ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during S3 upload. Check S3 CORS configuration.'));
      xhr.onabort = () => reject(new Error('S3 upload was cancelled.'));

      if (signal) {
        signal.addEventListener('abort', () => xhr.abort(), { once: true });
      }

      xhr.send(file);
    });

    return {
      success: true,
      fileKey,
      publicUrl,
    };
  } catch (error) {
    return {
      success: false,
      fileKey: '',
      publicUrl: '',
      error: error instanceof Error ? error.message : 'Unknown S3 upload error.',
    };
  }
}
