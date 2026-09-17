import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { ExtractedIcon, ExportSettings, ExportFormat } from '../types';

/**
 * Calculates target canvas size based on user settings
 */
export function getTargetDimensions(
  icon: ExtractedIcon,
  sizeSetting: ExportSettings['size'],
  customWidth: number,
  customHeight: number,
  lockAspectRatio: boolean
): { width: number; height: number } {
  const origW = Math.max(16, icon.width);
  const origH = Math.max(16, icon.height);
  const aspect = origW / origH;

  if (sizeSetting === 'original') {
    return { width: origW, height: origH };
  }

  if (sizeSetting === 'custom') {
    const w = Math.max(16, Math.min(8192, customWidth || 512));
    let h = Math.max(16, Math.min(8192, customHeight || 512));
    if (lockAspectRatio) {
      h = Math.round(w / aspect);
    }
    return { width: w, height: h };
  }

  const targetSide = parseInt(sizeSetting, 10) || 512;
  if (aspect >= 1) {
    return { width: targetSide, height: Math.round(targetSide / aspect) };
  } else {
    return { width: Math.round(targetSide * aspect), height: targetSide };
  }
}

/**
 * Renders an SVG string onto an HTML Canvas with background, padding, and target dimensions
 */
export async function renderSvgToCanvas(
  svgContent: string,
  targetWidth: number,
  targetHeight: number,
  background: ExportSettings['background'],
  customBgColor: string,
  paddingPercent: number,
  forceSolidBackground: boolean = false
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Could not create 2D canvas context'));
      return;
    }

    // Background handling
    if (forceSolidBackground || background !== 'transparent') {
      let bg = '#ffffff';
      if (background === 'black') bg = '#000000';
      else if (background === 'custom' && customBgColor) bg = customBgColor;
      else if (background === 'white') bg = '#ffffff';

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    } else {
      ctx.clearRect(0, 0, targetWidth, targetHeight);
    }

    const padFactor = paddingPercent / 100;
    const padX = targetWidth * padFactor;
    const padY = targetHeight * padFactor;
    const drawWidth = targetWidth - padX * 2;
    const drawHeight = targetHeight - padY * 2;

    const img = new Image();
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      // Center icon in the padded area
      const imgAspect = img.width / Math.max(1, img.height);
      const drawAspect = drawWidth / Math.max(1, drawHeight);

      let finalW = drawWidth;
      let finalH = drawHeight;
      let offsetX = padX;
      let offsetY = padY;

      if (imgAspect > drawAspect) {
        finalH = drawWidth / imgAspect;
        offsetY = padY + (drawHeight - finalH) / 2;
      } else {
        finalW = drawHeight * imgAspect;
        offsetX = padX + (drawWidth - finalW) / 2;
      }

      ctx.drawImage(img, offsetX, offsetY, finalW, finalH);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to render SVG to image: ' + err));
    };

    img.src = url;
  });
}

/**
 * Generates an SVG string formatted with user preferences
 */
export function formatSvgOutput(icon: ExtractedIcon, settings: ExportSettings): string {
  let svg = icon.svgContent;

  if (settings.svgOptimize) {
    // Remove extra whitespaces and empty attributes
    svg = svg.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
  }

  if (settings.svgResponsive) {
    // Replace fixed width and height with 100%
    svg = svg.replace(/width="[^"]*"/i, 'width="100%"').replace(/height="[^"]*"/i, 'height="100%"');
  }

  return svg;
}

/**
 * Computes filename for an icon based on template settings
 */
export function getIconFileName(
  icon: ExtractedIcon,
  index: number,
  settings: ExportSettings,
  formatExt: string
): string {
  const numStr = (index + 1).toString().padStart(2, '0');
  const cleanIconName = icon.name.replace(/\.[^/.]+$/, '');

  let baseName = `icon-${numStr}`;

  if (settings.namingPattern === 'icon-{name}' && cleanIconName) {
    baseName = cleanIconName;
  } else if (settings.namingPattern === 'custom' && settings.customPrefix) {
    baseName = `${settings.customPrefix}-${numStr}`;
  } else if (settings.namingPattern === 'icon-{index}') {
    baseName = `icon-${index + 1}`;
  }

  return `${baseName}.${formatExt}`;
}

/**
 * Export single icon in specific format
 */
export async function generateSingleIconBlob(
  icon: ExtractedIcon,
  format: ExportFormat,
  settings: ExportSettings
): Promise<{ blob: Blob; filename: string }> {
  const filename = getIconFileName(icon, icon.index - 1, settings, format);
  const dims = getTargetDimensions(
    icon,
    settings.size,
    settings.customWidth,
    settings.customHeight,
    settings.lockAspectRatio
  );

  switch (format) {
    case 'svg': {
      const svgText = formatSvgOutput(icon, settings);
      return {
        blob: new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }),
        filename,
      };
    }

    case 'eps': {
      return {
        blob: new Blob([icon.epsContent], { type: 'application/postscript;charset=utf-8' }),
        filename,
      };
    }

    case 'png': {
      const canvas = await renderSvgToCanvas(
        icon.svgContent,
        dims.width,
        dims.height,
        settings.background,
        settings.customBgColor,
        settings.padding,
        false
      );
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
      return { blob, filename };
    }

    case 'jpg': {
      const canvas = await renderSvgToCanvas(
        icon.svgContent,
        dims.width,
        dims.height,
        settings.background === 'transparent' ? 'white' : settings.background,
        settings.customBgColor,
        settings.padding,
        true // JPG must have solid background
      );
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95));
      return { blob, filename };
    }

    case 'webp': {
      const canvas = await renderSvgToCanvas(
        icon.svgContent,
        dims.width,
        dims.height,
        settings.background,
        settings.customBgColor,
        settings.padding,
        false
      );
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/webp', 0.95));
      return { blob, filename };
    }

    case 'pdf': {
      const doc = new jsPDF({
        orientation: dims.width >= dims.height ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [dims.width, dims.height],
      });

      const canvas = await renderSvgToCanvas(
        icon.svgContent,
        dims.width,
        dims.height,
        settings.background === 'transparent' ? 'white' : settings.background,
        settings.customBgColor,
        settings.padding,
        true
      );
      const dataUrl = canvas.toDataURL('image/png');
      doc.addImage(dataUrl, 'PNG', 0, 0, dims.width, dims.height);
      const pdfBlob = doc.output('blob');
      return { blob: pdfBlob, filename };
    }
  }
}

/**
 * Generates a multi-page PDF containing all selected icons
 */
export async function generateMultiPagePdf(
  icons: ExtractedIcon[],
  settings: ExportSettings,
  onProgress?: (curr: number, total: number) => void
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4', // 595.28 x 841.89 pt
  });

  const pageWidth = 595.28;
  const pageHeight = 841.89;

  for (let i = 0; i < icons.length; i++) {
    const icon = icons[i];
    onProgress?.(i + 1, icons.length);

    if (i > 0) {
      doc.addPage();
    }

    // Page header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 35, 45);
    doc.text(icon.name, 40, 50);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 110, 125);
    doc.text(`Icon ${i + 1} of ${icons.length} • Dimensions: ${icon.width} × ${icon.height} pt`, 40, 68);

    // Render icon centered on page
    const boxSize = 420;
    const canvas = await renderSvgToCanvas(
      icon.svgContent,
      boxSize,
      boxSize,
      'white',
      '#ffffff',
      10,
      true
    );
    const dataUrl = canvas.toDataURL('image/png');
    const posX = (pageWidth - boxSize) / 2;
    const posY = 120;
    doc.addImage(dataUrl, 'PNG', posX, posY, boxSize, boxSize);

    // Decorative frame
    doc.setDrawColor(220, 225, 235);
    doc.rect(posX, posY, boxSize, boxSize);

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(140, 150, 165);
    doc.text('Exported via IconSplit — EPS Icon Set Splitter', pageWidth / 2, pageHeight - 35, { align: 'center' });
  }

  return doc.output('blob');
}

/**
 * Triggers a browser download of a given Blob
 */
export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Batch Export Engine: Packages icons into a structured ZIP file
 */
export async function batchExportIcons(
  icons: ExtractedIcon[],
  settings: ExportSettings,
  zipPackageName: string = 'icon-set-export.zip',
  onProgress?: (curr: number, total: number, statusText: string) => void
): Promise<void> {
  const zip = new JSZip();
  const selectedIcons = icons.filter((i) => i.selected);

  if (selectedIcons.length === 0) {
    throw new Error('No icons selected for export');
  }

  // Handle Multi-Page PDF special case
  if (settings.format === 'pdf' && settings.pdfMultiPage && !settings.multiFormat) {
    onProgress?.(0, selectedIcons.length, 'Generating multi-page PDF catalog...');
    const pdfBlob = await generateMultiPagePdf(selectedIcons, settings, (curr, total) => {
      onProgress?.(curr, total, `Building PDF page ${curr} of ${total}...`);
    });
    triggerDownload(pdfBlob, 'icons-catalog.pdf');
    return;
  }

  const formatsToExport: ExportFormat[] = settings.multiFormat
    ? settings.selectedFormats.length > 0
      ? settings.selectedFormats
      : [settings.format]
    : [settings.format];

  const totalSteps = selectedIcons.length * formatsToExport.length;
  let currentStep = 0;

  for (const fmt of formatsToExport) {
    const folder = settings.multiFormat ? zip.folder(fmt.toUpperCase()) || zip : zip;

    for (let i = 0; i < selectedIcons.length; i++) {
      const icon = selectedIcons[i];
      currentStep++;
      const fname = getIconFileName(icon, i, settings, fmt);
      onProgress?.(currentStep, totalSteps, `Exporting [${fmt.toUpperCase()}] ${fname} (${currentStep}/${totalSteps})...`);

      const { blob } = await generateSingleIconBlob(icon, fmt, settings);
      folder.file(fname, blob);
    }
  }

  // If multi-format and PDF was selected with multi-page option, also add catalog
  if (settings.multiFormat && formatsToExport.includes('pdf') && settings.pdfMultiPage) {
    onProgress?.(totalSteps, totalSteps, 'Compiling combined PDF catalog...');
    const catalogPdfBlob = await generateMultiPagePdf(selectedIcons, settings);
    const pdfFolder = zip.folder('PDF') || zip;
    pdfFolder.file('all-icons-catalog.pdf', catalogPdfBlob);
  }

  onProgress?.(totalSteps, totalSteps, 'Compressing ZIP package...');
  const zipBlob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (metadata) => {
      onProgress?.(
        Math.round(metadata.percent),
        100,
        `Compressing ZIP archive (${Math.round(metadata.percent)}%)...`
      );
    }
  );

  triggerDownload(zipBlob, zipPackageName);
}
