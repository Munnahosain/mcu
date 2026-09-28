import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

type PreparedContour = THREE.Vector2[];

type PreparedShape = {
  color: string;
  contours: PreparedContour[];
};

export type PreparedSvgFor3D = {
  svg: string;
  shapeCount: number;
  skippedStrokePathCount: number;
};

function resolveFillColor(
  fill: string | undefined,
  fallbackColor: THREE.Color,
  gradientColors: Map<string, string>
): string {
  if (!fill || fill === "currentColor" || fill === "none" || fill === "transparent") {
    return `#${fallbackColor.getHexString()}`;
  }

  const gradientMatch = fill.match(/^url\(["']?#([^"')]+)["']?\)$/);
  if (gradientMatch) {
    return gradientColors.get(gradientMatch[1]) ?? `#${fallbackColor.getHexString()}`;
  }

  try {
    return `#${new THREE.Color(fill).getHexString()}`;
  } catch {
    return `#${fallbackColor.getHexString()}`;
  }
}

function formatContour(contour: PreparedContour, minX: number, minY: number, padding: number): string {
  const points = contour.length > 1 && contour[0].distanceToSquared(contour[contour.length - 1]) < 1e-8
    ? contour.slice(0, -1)
    : contour;
  if (points.length < 3) return "";

  const [firstPoint, ...remainingPoints] = points;
  const commands = [`M ${(firstPoint.x - minX + padding).toFixed(2)} ${(firstPoint.y - minY + padding).toFixed(2)}`];
  for (const point of remainingPoints) {
    commands.push(`L ${(point.x - minX + padding).toFixed(2)} ${(point.y - minY + padding).toFixed(2)}`);
  }
  commands.push("Z");
  return commands.join(" ");
}

export function prepareSvgFor3D(svgText: string): PreparedSvgFor3D {
  if (typeof DOMParser === "undefined") {
    throw new Error("3D preparation requires a browser SVG parser.");
  }

  const document = new DOMParser().parseFromString(svgText, "image/svg+xml");
  if (document.querySelector("parsererror")) {
    throw new Error("This SVG could not be parsed. Re-export it as a plain SVG and try again.");
  }

  const gradientColors = new Map<string, string>();
  document.querySelectorAll("linearGradient, radialGradient").forEach((gradient) => {
    const id = gradient.getAttribute("id");
    const stop = gradient.querySelector("stop");
    const color = stop?.getAttribute("stop-color") || (stop as SVGStopElement | null)?.style.stopColor;
    if (id && color) {
      try {
        gradientColors.set(id, `#${new THREE.Color(color).getHexString()}`);
      } catch {
        gradientColors.set(id, "#16c784");
      }
    }
  });

  const parsed = new SVGLoader().parse(svgText);
  const preparedShapes: PreparedShape[] = [];
  let skippedStrokePathCount = 0;

  for (const path of parsed.paths) {
    const style = path.userData?.style as { fill?: string; stroke?: string } | undefined;
    if (style?.fill === "none") {
      if (style.stroke && style.stroke !== "none") skippedStrokePathCount += 1;
      continue;
    }

    const fillValue = style?.fill;
    const gradientMatch = fillValue?.match(/^url\(["']?#([^"')]+)["']?\)$/);
    const preparedColor = resolveFillColor(fillValue, path.color, gradientColors);
    const shapes = SVGLoader.createShapes(path);

    for (const shape of shapes) {
      const extracted = shape.extractPoints(32);
      const contours = [extracted.shape, ...extracted.holes].filter((contour) => contour.length >= 3);
      if (contours.length) preparedShapes.push({ color: preparedColor, contours });
    }

    if (!shapes.length && style?.stroke && style.stroke !== "none") {
      skippedStrokePathCount += 1;
    }

    if (gradientMatch && !gradientColors.has(gradientMatch[1])) {
      gradientColors.set(gradientMatch[1], preparedColor);
    }
  }

  if (!preparedShapes.length) {
    throw new Error("No filled closed shapes were found. Convert strokes to outlines before 3D preparation.");
  }

  const allPoints = preparedShapes.flatMap((shape) => shape.contours.flat());
  const minX = Math.min(...allPoints.map((point) => point.x));
  const minY = Math.min(...allPoints.map((point) => point.y));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const maxY = Math.max(...allPoints.map((point) => point.y));
  const padding = Math.max(maxX - minX, maxY - minY) * 0.06;
  const width = Math.max(16, maxX - minX + padding * 2);
  const height = Math.max(16, maxY - minY + padding * 2);

  const paths = preparedShapes.map(({ color, contours }) => {
    const pathData = contours
      .map((contour) => formatContour(contour, minX, minY, padding))
      .filter(Boolean)
      .join(" ");
    return `  <path d="${pathData}" fill="${color}" fill-rule="evenodd"/>`;
  });

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}" width="${Math.ceil(width)}" height="${Math.ceil(height)}">\n${paths.join("\n")}\n</svg>`,
    shapeCount: preparedShapes.length,
    skippedStrokePathCount,
  };
}