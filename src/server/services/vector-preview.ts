import { execFile } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { extractEmbeddedSVG, extractPostScriptText, processEPSFile } from '@/services/epsParser';

export type VectorFormat = 'AI' | 'EPS' | 'SVG' | 'PDF';

const VECTOR_EXTENSIONS: Record<string, VectorFormat> = {
  ai: 'AI',
  eps: 'EPS',
  epsf: 'EPS',
  svg: 'SVG',
  pdf: 'PDF',
};

const execFileAsync = promisify(execFile);

function configuredNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export class VectorPreviewError extends Error {
  constructor(public readonly code: 'INVALID_FILE_SIGNATURE' | 'VECTOR_RENDER_FAILED' | 'UNSUPPORTED_VECTOR_RENDERING', message: string) {
    super(message);
    this.name = 'VectorPreviewError';
  }
}

export function getVectorFormat(filename: string): VectorFormat | null {
  const extension = filename.toLowerCase().split('.').pop() || '';
  return VECTOR_EXTENSIONS[extension] || null;
}

function hasPdfSignature(buffer: Buffer) {
  return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

function hasPostScriptSignature(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  // Check for DOS EPS binary header magic: 0xC5, 0xD0, 0xD3, 0xC6
  if (buffer[0] === 0xc5 && buffer[1] === 0xd0 && buffer[2] === 0xd3 && buffer[3] === 0xc6) {
    return true;
  }
  // Check for PostScript magic in the header (up to first 8192 bytes)
  const header = buffer.subarray(0, Math.min(buffer.length, 8192)).toString('latin1');
  return header.includes('%!PS') || header.includes('%!PS-Adobe') || header.startsWith('%!');
}

function rendererPath(): string {
  if (process.env.GHOSTSCRIPT_PATH) return process.env.GHOSTSCRIPT_PATH;
  if (process.platform === 'win32') {
    // 1. Auto-detect Ghostscript in standard Windows installation directories
    try {
      const gsBase = 'C:\\Program Files\\gs';
      if (existsSync(gsBase)) {
        const entries = readdirSync(gsBase, { withFileTypes: true });
        const gsDirs = entries.filter((e) => e.isDirectory() && e.name.startsWith('gs')).map((e) => e.name).sort().reverse();
        for (const dir of gsDirs) {
          const exePath = join(gsBase, dir, 'bin', 'gswin64c.exe');
          if (existsSync(exePath)) return exePath;
        }
      }
    } catch {
      // fallback
    }
    return 'gswin64c';
  }
  return 'gs';
}

async function renderWithGhostscript(buffer: Buffer, filename: string): Promise<Buffer> {
  const directory = await mkdtemp(join(tmpdir(), 'mcustock-vector-'));
  const isPdf = filename.toLowerCase().endsWith('.pdf');
  const inputPath = join(directory, `source.${isPdf ? 'pdf' : 'ps'}`);
  const outputPath = join(directory, 'preview.png');

  try {
    await writeFile(inputPath, buffer, { mode: 0o600 });
    const args = [
      '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET', '-sDEVICE=pngalpha', '-r144',
      ...(isPdf ? [] : ['-dEPSCrop']),
      '-dFirstPage=1', '-dLastPage=1', `-sOutputFile=${outputPath}`, inputPath,
    ];

    await execFileAsync(rendererPath(), args, {
      timeout: configuredNumber('VECTOR_RENDER_TIMEOUT_MS', 45_000),
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });

    const outputStats = await stat(outputPath);
    if (outputStats.size > configuredNumber('VECTOR_MAX_RENDERED_PREVIEW_BYTES', 25 * 1024 * 1024)) {
      throw new Error('Rendered preview exceeded the output limit.');
    }
    const rendered = await readFile(outputPath);
    return await sharp(rendered)
      .flatten({ background: '#ffffff' })
      .png()
      .toBuffer();
  } catch (err) {
    console.warn(`[vector-preview] Ghostscript render failed for ${filename}:`, err instanceof Error ? err.message : err);
    throw new VectorPreviewError('VECTOR_RENDER_FAILED', 'Unable to generate a safe vector preview.');
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

function sanitizeSvg(source: string): string {
  let svg = source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:href|xlink:href)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, (attribute) => {
      return /(?:#|data:image\/(?:png|jpeg|webp);base64,)/i.test(attribute) ? attribute : '';
    })
    .replace(/url\s*\(\s*["']?(?:https?:|file:|javascript:)[^)]*["']?\s*\)/gi, 'none')
    .replace(/(?:https?:|file:|javascript:)[^"'\s)]+/gi, '');

  if (!/<svg\b/i.test(svg)) throw new VectorPreviewError('INVALID_FILE_SIGNATURE', 'The SVG structure is invalid.');
  if (!/\bxmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/i.test(svg)) {
    svg = svg.replace(/<svg\b([^>]*)>/i, '<svg$1 xmlns="http://www.w3.org/2000/svg">');
  }
  return svg;
}

async function rasterizeSvg(svg: string) {
  try {
    const rendered = new Resvg(svg, {
      fitTo: { mode: 'width', value: configuredNumber('VECTOR_PREVIEW_WIDTH', 1600) },
      font: { loadSystemFonts: false },
    }).render();
    return await sharp(rendered.asPng()).flatten({ background: '#ffffff' }).png().toBuffer();
  } catch {
    return await sharp(Buffer.from(svg), { density: 144 }).flatten({ background: '#ffffff' }).png().toBuffer();
  }
}

/**
 * Extracts embedded raster preview (TIFF thumbnail, XMP JPEG, embedded SVG, or Photoshop preview)
 * directly from vector file buffers without requiring external binaries.
 */
async function extractEmbeddedPreview(buffer: Buffer): Promise<Buffer | null> {
  // 1. Check for DOS EPS embedded TIFF thumbnail (offsets at byte 20 and 24)
  if (buffer.length >= 30 && buffer[0] === 0xc5 && buffer[1] === 0xd0 && buffer[2] === 0xd3 && buffer[3] === 0xc6) {
    const tiffOffset = buffer.readUInt32LE(20);
    const tiffLength = buffer.readUInt32LE(24);
    if (tiffOffset > 0 && tiffLength > 0 && tiffOffset + tiffLength <= buffer.length) {
      try {
        const tiffBuf = buffer.subarray(tiffOffset, tiffOffset + tiffLength);
        const png = await sharp(tiffBuf)
          .flatten({ background: '#ffffff' })
          .png()
          .toBuffer();
        if (png && png.length > 0) return png;
      } catch (err) {
        console.warn('[vector-preview] Failed to decode DOS EPS TIFF preview:', err);
      }
    }
  }

  // 2. Check for XMP thumbnail (<xmpGImg:image>) in metadata
  const headerText = buffer.subarray(0, Math.min(buffer.length, 3 * 1024 * 1024)).toString('latin1');
  const xmpMatch = headerText.match(/<xmpGImg:image>([A-Za-z0-9+/=\s]+)<\/xmpGImg:image>/i);
  if (xmpMatch) {
    try {
      const cleanB64 = xmpMatch[1].replace(/\s+/g, '');
      const imgBuf = Buffer.from(cleanB64, 'base64');
      const png = await sharp(imgBuf)
        .flatten({ background: '#ffffff' })
        .png()
        .toBuffer();
      if (png && png.length > 0) return png;
    } catch (err) {
      console.warn('[vector-preview] Failed to decode XMP thumbnail preview:', err);
    }
  }

  // 3. Check for embedded SVG markup inside EPS PostScript comments/metadata
  const embeddedSvg = extractEmbeddedSVG(headerText);
  if (embeddedSvg) {
    try {
      const sanitized = sanitizeSvg(embeddedSvg);
      const png = await rasterizeSvg(sanitized);
      if (png && png.length > 0) return png;
    } catch (err) {
      console.warn('[vector-preview] Failed to render embedded SVG preview:', err);
    }
  }

  // 4. Check for embedded JPEG binary streams (Photoshop EPS / JPEG preview markers)
  const previewWindow = buffer.subarray(0, Math.min(buffer.length, 500_000));
  const soiIndex = previewWindow.indexOf(Buffer.from([0xff, 0xd8, 0xff]));
  if (soiIndex !== -1) {
    const eoiIndex = previewWindow.indexOf(Buffer.from([0xff, 0xd9]), soiIndex + 10);
    if (eoiIndex !== -1 && eoiIndex > soiIndex) {
      try {
        const jpegBuf = previewWindow.subarray(soiIndex, eoiIndex + 2);
        const png = await sharp(jpegBuf)
          .flatten({ background: '#ffffff' })
          .png()
          .toBuffer();
        if (png && png.length > 0) return png;
      } catch {
        // ignore
      }
    }
  }

  return null;
}

export async function prepareVectorPreview(buffer: Buffer, filename: string): Promise<{ buffer: Buffer; format: VectorFormat }> {
  const format = getVectorFormat(filename);
  if (!format) throw new VectorPreviewError('INVALID_FILE_SIGNATURE', 'Unsupported vector format.');

  try {
    if (format === 'SVG') {
      const svg = sanitizeSvg(buffer.toString('utf8'));
      return { buffer: await rasterizeSvg(svg), format };
    }

    if (format === 'EPS') {
      if (!hasPostScriptSignature(buffer)) {
        throw new VectorPreviewError('INVALID_FILE_SIGNATURE', 'The EPS file signature is invalid.');
      }

      // Step 1: Check for high-fidelity embedded raster preview (TIFF / XMP JPEG / embedded SVG)
      const embedded = await extractEmbeddedPreview(buffer);
      if (embedded) {
        return { buffer: embedded, format };
      }

      // Step 2: Try Ghostscript rendering with -dEPSCrop
      try {
        return { buffer: await renderWithGhostscript(buffer, filename), format };
      } catch (gsError) {
        console.warn(`[vector-preview] Ghostscript failed for ${filename}, attempting PostScript parser...`, gsError);
      }

      // Step 3: Fallback to PostScript path parsing
      try {
        const psText = extractPostScriptText(buffer);
        const parsed = await processEPSFile({ name: filename, size: buffer.length, content: psText });
        const svg = sanitizeSvg(parsed.fullSvg);
        return { buffer: await rasterizeSvg(svg), format };
      } catch (parserError) {
        console.error(`[vector-preview] PostScript parser failed for ${filename}:`, parserError);
      }

      throw new VectorPreviewError(
        'VECTOR_RENDER_FAILED',
        'Could not render a preview for this EPS vector file. Please ensure it contains vector paths, an embedded preview, or save it as SVG.'
      );
    }

    if (format === 'AI') {
      // Step 1: Try embedded raster thumbnail (XMP JPEG or TIFF)
      const embedded = await extractEmbeddedPreview(buffer);
      if (embedded) {
        return { buffer: embedded, format };
      }

      // Step 2: Check for PDF or PostScript compatibility stream and render with Ghostscript
      if (hasPdfSignature(buffer) || hasPostScriptSignature(buffer)) {
        return { buffer: await renderWithGhostscript(buffer, filename), format };
      }

      throw new VectorPreviewError(
        'UNSUPPORTED_VECTOR_RENDERING',
        'This AI file has no renderable PDF compatibility stream or embedded preview. In Adobe Illustrator, check "Create PDF Compatible File" when saving, or export as SVG.'
      );
    }

    if (format === 'PDF' && hasPdfSignature(buffer)) {
      try {
        return { buffer: await renderWithGhostscript(buffer, filename), format };
      } catch {
        const embedded = await extractEmbeddedPreview(buffer);
        if (embedded) {
          return { buffer: embedded, format };
        }
        throw new VectorPreviewError('VECTOR_RENDER_FAILED', 'Unable to generate a preview for this PDF file.');
      }
    }

    throw new VectorPreviewError('INVALID_FILE_SIGNATURE', 'The vector file signature is invalid.');
  } catch (error) {
    if (error instanceof VectorPreviewError) throw error;
    throw new VectorPreviewError('VECTOR_RENDER_FAILED', 'Unable to generate a safe vector preview.');
  }
}