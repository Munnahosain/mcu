const MAX_UPLOAD_BYTES = 500_000;
const MAX_DIMENSION = 800;
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

    const blob = await canvasToBlob(canvas, 0.82, 'image/jpeg');
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

let pdfjsPromise: Promise<any> | null = null;

function loadPdfJs(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window not available'));
  if ((window as any).pdfjsLib) return Promise.resolve((window as any).pdfjsLib);
  if (pdfjsPromise) return pdfjsPromise;

  pdfjsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-pdfjs="true"]') as HTMLScriptElement | null;
    if (existing) {
      if ((window as any).pdfjsLib) return resolve((window as any).pdfjsLib);
      existing.addEventListener('load', () => resolve((window as any).pdfjsLib));
      existing.addEventListener('error', () => reject(new Error('PDF.js script load error')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.setAttribute('data-pdfjs', 'true');
    script.onload = () => {
      const pdfjs = (window as any).pdfjsLib;
      if (pdfjs) {
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(pdfjs);
      } else {
        reject(new Error('PDF.js not initialized'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load PDF preview engine from CDN'));
    document.head.appendChild(script);
  });

  return pdfjsPromise;
}

async function isValidImageBlob(blob: Blob): Promise<boolean> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob);
      const ok = bmp.width >= 32 && bmp.height >= 32;
      bmp.close();
      return ok;
    } catch {
      return false;
    }
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img.naturalWidth >= 32 && img.naturalHeight >= 32);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    img.src = url;
  });
}

async function extractXmpThumbnail(file: File): Promise<File | null> {
  const CHUNK_SIZE = 4 * 1024 * 1024;
  const tagRegex = /(?:<|&lt;)(?:xmpGImg|xapGImg):image\b[^>&]*(?:>|&gt;)(?:<!\[CDATA\[)?\s*([A-Za-z0-9+/=\s]{100,})\s*(?:\]\]>)?(?:<\/|&lt;\/)(?:xmpGImg|xapGImg):image(?:>|&gt;)/i;
  const attrRegex = /(?:xmpGImg|xapGImg):image\s*=\s*["']([A-Za-z0-9+/=\s]{100,})["']/i;

  const sliceRanges: Array<[number, number]> = [];
  sliceRanges.push([0, Math.min(file.size, CHUNK_SIZE)]);
  if (file.size > CHUNK_SIZE) {
    sliceRanges.push([Math.max(0, file.size - CHUNK_SIZE), file.size]);
  }
  if (file.size > CHUNK_SIZE * 2 && file.size <= 30 * 1024 * 1024) {
    for (let offset = CHUNK_SIZE; offset < file.size - CHUNK_SIZE; offset += CHUNK_SIZE) {
      sliceRanges.push([offset, Math.min(file.size, offset + CHUNK_SIZE)]);
    }
  }

  for (const [start, end] of sliceRanges) {
    try {
      const slice = file.slice(start, end);
      const text = await slice.text();
      const match = text.match(tagRegex) || text.match(attrRegex);
      if (match && match[1]) {
        const cleanB64 = match[1].replace(/\s+/g, '');
        const byteChars = atob(cleanB64);
        const bytes = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          bytes[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'image/jpeg' });
        if (await isValidImageBlob(blob)) {
          return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: file.lastModified,
          });
        }
      }
    } catch {
      // ignore slice read errors
    }
  }
  return null;
}

async function renderPdfWithPdfJs(file: File): Promise<File | null> {
  try {
    const pdfjs = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
      stopAtErrors: false,
    });
    const pdf = await loadingTask.promise;
    if (!pdf || pdf.numPages < 1) return null;

    const page = await pdf.getPage(1);
    const initialViewport = page.getViewport({ scale: 1.0 });
    const maxDim = Math.max(initialViewport.width || 1, initialViewport.height || 1);
    const scale = Math.min(2.0, MAX_DIMENSION / maxDim);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const context = canvas.getContext('2d');
    if (!context) return null;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context,
      viewport,
      background: 'rgb(255, 255, 255)',
    }).promise;

    const blob = await canvasToBlob(canvas, 0.82, 'image/jpeg');
    return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } catch (err) {
    console.warn('[client-image] PDF preview rendering skipped:', err);
    return null;
  }
}

async function extractEmbeddedJpeg(file: File): Promise<File | null> {
  try {
    const scanSize = Math.min(file.size, 16 * 1024 * 1024);
    const slice = file.slice(0, scanSize);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    for (let i = 0; i < bytes.length - 1000; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
        for (let j = i + 1000; j < Math.min(bytes.length, i + 4_000_000); j++) {
          if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
            const jpegBytes = bytes.subarray(i, j + 2);
            if (jpegBytes.length >= 4096) {
              const blob = new Blob([jpegBytes], { type: 'image/jpeg' });
              if (await isValidImageBlob(blob)) {
                return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                  type: 'image/jpeg',
                  lastModified: file.lastModified,
                });
              }
            }
            break;
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function prepareImageForUpload(file: File): Promise<File> {
  if (isSvgFile(file)) return rasterizeSvgForUpload(file);
  if (isVectorFile(file)) {
    // 1. Try XMP thumbnail extraction across chunks (first 4MB, last 4MB, etc.)
    const xmpThumb = await extractXmpThumbnail(file);
    if (xmpThumb) return xmpThumb;

    // 2. Try PDF.js rendering for PDF/AI vector assets
    if (/\.(ai|pdf)$/i.test(file.name)) {
      const pdfThumb = await renderPdfWithPdfJs(file);
      if (pdfThumb) return pdfThumb;
    }

    // 3. Try embedded JPEG stream extraction
    const jpegThumb = await extractEmbeddedJpeg(file);
    if (jpegThumb) return jpegThumb;

    // 4. If under 4MB, safe to upload raw file for server Ghostscript rendering
    if (file.size <= 4 * 1024 * 1024) {
      return file;
    }

    // 5. File is over 4MB and cannot be rendered on client
    throw new Error(
      `The vector file "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the upload size limit (4MB). In Adobe Illustrator, please save with "Create PDF Compatible File" checked, or export as SVG/JPG.`
    );
  }
  return compressImageForUpload(file);
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
  if (file.size <= 120_000 && file.type === 'image/jpeg') return file;

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
