import { DesignElement, PhysicalUnit, RepeatType } from '../types';

export interface WrappedInstance {
  dx: number; // -1, 0, 1
  dy: number; // -1, 0, 1
  isPrimary: boolean;
  x: number;
  y: number;
}

/**
 * Calculates which of the 9 toroidal positions (dx, dy in {-1, 0, 1})
 * for a given element overlap the artboard [0, artboardSize] x [0, artboardSize].
 */
export function getToroidalInstances(
  element: DesignElement,
  artboardSize: number
): WrappedInstance[] {
  const instances: WrappedInstance[] = [];
  const halfDiag = Math.max(element.width, element.height) * 1.5;

  // Check all 9 virtual tile positions
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const px = element.x + dx * artboardSize;
      const py = element.y + dy * artboardSize;

      // Check if this instance bounding circle/box intersects [0, artboardSize]
      const left = px - halfDiag;
      const right = px + halfDiag;
      const top = py - halfDiag;
      const bottom = py + halfDiag;

      const intersects =
        right >= 0 && left <= artboardSize && bottom >= 0 && top <= artboardSize;

      if (intersects) {
        instances.push({
          dx,
          dy,
          isPrimary: dx === 0 && dy === 0,
          x: px,
          y: py,
        });
      }
    }
  }

  // Ensure at least the primary instance is returned
  if (!instances.some((i) => i.isPrimary)) {
    instances.unshift({
      dx: 0,
      dy: 0,
      isPrimary: true,
      x: element.x,
      y: element.y,
    });
  }

  return instances;
}

/**
 * Wraps coordinate into [0, artboardSize) range smoothly
 */
export function wrapCoordinate(val: number, artboardSize: number): number {
  return ((val % artboardSize) + artboardSize) % artboardSize;
}

/**
 * Checks if an element crosses any edge of the artboard
 */
export function isElementCrossingEdge(
  element: DesignElement,
  artboardSize: number
): { left: boolean; right: boolean; top: boolean; bottom: boolean } {
  const r = Math.max(element.width, element.height) / 2;
  return {
    left: element.x - r < 0,
    right: element.x + r > artboardSize,
    top: element.y - r < 0,
    bottom: element.y + r > artboardSize,
  };
}

/**
 * Converts physical units to standard cm and inches
 */
export function convertUnits(
  val: number,
  from: PhysicalUnit,
  to: PhysicalUnit
): number {
  if (from === to) return val;
  // Convert to cm first
  let cm = val;
  if (from === 'inch') cm = val * 2.54;
  else if (from === 'mm') cm = val / 10;

  // Convert cm to target
  if (to === 'cm') return cm;
  if (to === 'inch') return cm / 2.54;
  if (to === 'mm') return cm * 10;
  return cm;
}

export interface FabricCalculation {
  tileSizeCm: number;
  tileSizeInches: number;
  boltWidthCm: number;
  boltWidthInches: number;
  fabricLengthCm: number;
  fabricLengthInches: number;
  repeatsAcrossWidth: number;
  remainingWidthCm: number;
  repeatsAlongLength: number;
  remainingLengthCm: number;
  totalRepeatsInYardage: number;
  recommendedCutWidthCm: number;
  recommendedCutLengthCm: number;
  dpiResolution: number;
  pixelWidthForPrint: number; // e.g. at 300 DPI
}

export function calculateFabricMetrics(
  physicalSize: number,
  unit: PhysicalUnit,
  boltWidth: number,
  fabricLength: number,
  dpi: number
): FabricCalculation {
  const tileSizeCm = convertUnits(physicalSize, unit, 'cm');
  const tileSizeInches = convertUnits(physicalSize, unit, 'inch');

  const boltWidthCm = convertUnits(boltWidth, unit, 'cm');
  const boltWidthInches = convertUnits(boltWidth, unit, 'inch');

  const fabricLengthCm = convertUnits(fabricLength, unit, 'cm');
  const fabricLengthInches = convertUnits(fabricLength, unit, 'inch');

  const repeatsAcrossWidth = Math.max(1, Math.floor(boltWidthCm / tileSizeCm));
  const remainingWidthCm = Number((boltWidthCm - repeatsAcrossWidth * tileSizeCm).toFixed(2));

  const repeatsAlongLength = Math.max(1, Math.floor(fabricLengthCm / tileSizeCm));
  const remainingLengthCm = Number((fabricLengthCm - repeatsAlongLength * tileSizeCm).toFixed(2));

  const totalRepeatsInYardage = repeatsAcrossWidth * repeatsAlongLength;

  const recommendedCutWidthCm = Number((repeatsAcrossWidth * tileSizeCm).toFixed(1));
  const recommendedCutLengthCm = Number((repeatsAlongLength * tileSizeCm).toFixed(1));

  // At specified DPI (e.g. 300 DPI): pixels = inches * DPI
  const pixelWidthForPrint = Math.round(tileSizeInches * dpi);

  return {
    tileSizeCm: Number(tileSizeCm.toFixed(2)),
    tileSizeInches: Number(tileSizeInches.toFixed(2)),
    boltWidthCm: Number(boltWidthCm.toFixed(1)),
    boltWidthInches: Number(boltWidthInches.toFixed(1)),
    fabricLengthCm: Number(fabricLengthCm.toFixed(1)),
    fabricLengthInches: Number(fabricLengthInches.toFixed(1)),
    repeatsAcrossWidth,
    remainingWidthCm,
    repeatsAlongLength,
    remainingLengthCm,
    totalRepeatsInYardage,
    recommendedCutWidthCm,
    recommendedCutLengthCm,
    dpiResolution: dpi,
    pixelWidthForPrint,
  };
}
