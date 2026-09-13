/**
 * Universal Robust Browser Download Helper
 * Ensures all file types (Blob, DataURL, text/SVG/JSON, canvas) download reliably
 * across all browsers without premature stream cancellations or memory leaks.
 */

export function downloadBlob(blob: Blob, filename: string): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.style.display = "none";
    link.href = url;
    link.download = filename;
    link.setAttribute("download", filename);
    link.rel = "noopener noreferrer";

    document.body.appendChild(link);
    link.click();

    // Defer revokeObjectURL to ensure browser download pipeline has safely captured the stream
    setTimeout(() => {
      try {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
        URL.revokeObjectURL(url);
      } catch {
        // Silently ignore cleanup errors
      }
    }, 1500);

    return true;
  } catch (error) {
    console.error("Download failed:", error);
    return false;
  }
}

export function downloadDataUrl(dataUrl: string, filename: string): boolean {
  try {
    const link = document.createElement("a");
    link.style.display = "none";
    link.href = dataUrl;
    link.download = filename;
    link.setAttribute("download", filename);
    link.rel = "noopener noreferrer";

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      try {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      } catch {
        // Silently ignore cleanup errors
      }
    }, 1000);

    return true;
  } catch (error) {
    console.error("DataURL download failed:", error);
    return false;
  }
}

export function downloadText(content: string, filename: string, mimeType = "text/plain;charset=utf-8"): boolean {
  const blob = new Blob([content], { type: mimeType });
  return downloadBlob(blob, filename);
}

export function downloadJson(data: unknown, filename: string): boolean {
  const jsonStr = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return downloadText(jsonStr, filename, "application/json;charset=utf-8");
}

export async function copyBlobToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
      return false;
    }
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type || "image/png"]: blob,
      }),
    ]);
    return true;
  } catch (err) {
    console.warn("Clipboard write failed:", err);
    return false;
  }
}
