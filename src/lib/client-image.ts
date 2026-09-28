const MAX_UPLOAD_BYTES = 1_500_000;
const MAX_DIMENSION = 1600;
const VECTOR_FILE_PATTERN = /\.(ai|eps|epsf|svg|pdf)$/i;
const VIDEO_FILE_PATTERN = /\.(mp4|mov|webm|m4v)$/i;

export function isVectorFile(file: File) {
  return VECTOR_FILE_PATTERN.test(file.name);
}

export function isVideoFile(file: File) {
  return file.type.startsWith('video/') || VIDEO_FILE_PATTERN.test(file.name);
}

function isSvgFile(file: File) {
  return /\.svg$/i.test(file.name);
}

async function rasterizeSvgForUpload(file: File): Promise<File> {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  try {
    image.decoding = 'async';
    image.src = objectUrl;
    await image.decode();

    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare the SVG preview.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await canvasToBlob(canvas, 0.86, 'image/jpeg');
    return new File([blob], file.name.replace(/\.svg$/i, '.jpg'), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } catch {
    throw new Error(`The SVG "${file.name}" could not be rendered for metadata generation.`);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function prepareImageForUpload(file: File) {
  if (isSvgFile(file)) return rasterizeSvgForUpload(file);
  return isVectorFile(file) ? Promise.resolve(file) : compressImageForUpload(file);
}

export async function createVideoContactSheet(file: File): Promise<File> {
  const video = document.createElement('video');
  const objectUrl = URL.createObjectURL(file);
  video.preload = 'metadata';
  video.muted = true;
  video.src = objectUrl;

  try {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
      video.addEventListener('error', () => reject(new Error('This video could not be decoded by your browser.')), { once: true });
    });
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error('This video has no supported duration for frame analysis.');
    }

    const frameWidth = 512;
    const frameHeight = 288;
    const canvas = document.createElement('canvas');
    canvas.width = frameWidth * 2;
    canvas.height = frameHeight * 2;
    const context = canvas.getContext('2d');
    if (!context || !video.videoWidth || !video.videoHeight) {
      throw new Error('This video does not contain readable frames.');
    }

    const frameTimes = [0.1, 0.35, 0.65, 0.9].map((portion) =>
      Math.min(video.duration * portion, Math.max(video.duration - 0.05, 0))
    );
    for (const [index, time] of frameTimes.entries()) {
      if (Math.abs(video.currentTime - time) >= 0.01) {
        await new Promise<void>((resolve, reject) => {
          video.addEventListener('seeked', () => resolve(), { once: true });
          video.addEventListener('error', () => reject(new Error('A video frame could not be decoded.')), { once: true });
          video.currentTime = time;
        });
      }

      const scale = Math.min(frameWidth / video.videoWidth, frameHeight / video.videoHeight);
      const width = video.videoWidth * scale;
      const height = video.videoHeight * scale;
      const x = (index % 2) * frameWidth + (frameWidth - width) / 2;
      const y = Math.floor(index / 2) * frameHeight + (frameHeight - height) / 2;
      context.fillStyle = '#111111';
      context.fillRect((index % 2) * frameWidth, Math.floor(index / 2) * frameHeight, frameWidth, frameHeight);
      context.drawImage(video, x, y, width, height);
    }

    const blob = await canvasToBlob(canvas, 0.85, 'image/jpeg');
    return new File([blob], 'video-contact-sheet.jpg', { type: 'image/jpeg' });
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

export async function compressImageForUpload(file: File): Promise<File> {
  if (file.size <= MAX_UPLOAD_BYTES && file.type === 'image/jpeg') return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`The image "${file.name}" could not be decoded. Please choose a valid JPG, PNG, or WebP file.`);
  }

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let quality = 0.78;
    let blob = await canvasToBlob(canvas, quality);
    while (blob.size > MAX_UPLOAD_BYTES && quality > 0.4) {
      quality -= 0.08;
      blob = await canvasToBlob(canvas, quality);
    }

    return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number, type = 'image/jpeg') {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not compress image for upload.'));
    }, type, quality);
  });
}
