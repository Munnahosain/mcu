import DOMPurify from 'dompurify';

/**
 * Removes scripts, event handlers (onload, onclick…), foreignObject and javascript: URLs from SVG markup
 * before it is rendered with dangerouslySetInnerHTML. Keeps normal drawing content: ids, defs,
 * gradients, patterns, masks, clip paths and internal <use href="#id"> references.
 */
export function sanitizeSvg(svg: string): string {
  if (!svg) return '';

  if (typeof window === 'undefined' || !DOMPurify.isSupported) {
    // Server (no DOM): conservative string clean-up. Markup is only rendered in the browser,
    // where the full DOMPurify pass runs.
    return svg
      .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
      .replace(/<script[^>]*\/?>/gi, '')
      .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(href\s*=\s*["']?)\s*javascript:[^"'\s>]*/gi, '$1#');
  }

  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['use'],
    ADD_ATTR: ['xlink:href', 'href'],
    FORBID_TAGS: ['script', 'foreignObject'],
  });
}
