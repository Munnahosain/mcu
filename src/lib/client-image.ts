const MAX_UPLOAD_BYTES = 1_500_000;
const MAX_DIMENSION = 1600;
const VECTOR_FILE_PATTERN = /\.(ai|eps|epsf|svg|pdf)$/i;

export function isVectorFile(file: File) {
  return VECTOR_FILE_PATTERN.test(file.name);
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
