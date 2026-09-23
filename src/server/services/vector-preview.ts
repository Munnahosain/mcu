import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { processEPSFile } from '@/services/epsParser';

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

function hasPostScriptSignature(buffer: Buffer) {
  const header = buffer.subarray(0, 1024).toString('latin1');
  return header.startsWith('%!PS-') || header.includes('%!PS-Adobe');
}

function rendererPath() {
  return process.env.GHOSTSCRIPT_PATH || (process.platform === 'win32' ? 'gswin64c' : 'gs');
}

async function renderWithGhostscript(buffer: Buffer, filename: string): Promise<Buffer> {
  const directory = await mkdtemp(join(tmpdir(), 'mcustock-vector-'));
  const inputPath = join(directory, `source.${filename.toLowerCase().endsWith('.pdf') ? 'pdf' : 'ps'}`);
  const outputPath = join(directory, 'preview.png');

  try {
    await writeFile(inputPath, buffer, { mode: 0o600 });
    await execFileAsync(rendererPath(), [
      '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET', '-sDEVICE=pngalpha', '-r144',
      '-dFirstPage=1', '-dLastPage=1', `-sOutputFile=${outputPath}`, inputPath,
    ], {
      timeout: configuredNumber('VECTOR_RENDER_TIMEOUT_MS', 45_000),
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });

    const outputStats = await stat(outputPath);
    if (outputStats.size > configuredNumber('VECTOR_MAX_RENDERED_PREVIEW_BYTES', 25 * 1024 * 1024)) {
      throw new Error('Rendered preview exceeded the output limit.');
    }
    return await readFile(outputPath);
  } catch {
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
    return await sharp(rendered.asPng()).png().toBuffer();
  } catch {
    return await sharp(Buffer.from(svg), { density: 144 }).png().toBuffer();
  }
}

export async function prepareVectorPreview(buffer: Buffer, filename: string): Promise<{ buffer: Buffer; format: VectorFormat }> {
  const format = getVectorFormat(filename);
  if (!format) throw new VectorPreviewError('INVALID_FILE_SIGNATURE', 'Unsupported vector format.');

  try {
    if (format === 'SVG') {
      const svg = sanitizeSvg(buffer.toString('utf8'));
      return { buffer: await rasterizeSvg(svg), format };
    }

    if (format === 'EPS' && hasPostScriptSignature(buffer)) {
      try {
        const parsed = await processEPSFile({ name: filename, size: buffer.length, content: buffer.toString('latin1') });
        const svg = sanitizeSvg(parsed.fullSvg);
        return { buffer: await rasterizeSvg(svg), format };
      } catch {
        return { buffer: await renderWithGhostscript(buffer, filename), format };
      }
    }

    if (format === 'PDF' && hasPdfSignature(buffer)) {
      return { buffer: await renderWithGhostscript(buffer, filename), format };
    }

    if (format === 'AI') {
      if (hasPdfSignature(buffer) || hasPostScriptSignature(buffer)) {
        return { buffer: await renderWithGhostscript(buffer, filename), format };
      }
      throw new VectorPreviewError('UNSUPPORTED_VECTOR_RENDERING', 'This AI file has no renderable PDF or PostScript preview.');
    }

    throw new VectorPreviewError('INVALID_FILE_SIGNATURE', 'The vector file signature is invalid.');
  } catch (error) {
    if (error instanceof VectorPreviewError) throw error;
    throw new VectorPreviewError('VECTOR_RENDER_FAILED', 'Unable to generate a safe vector preview.');
  }
}