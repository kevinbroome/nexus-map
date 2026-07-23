import type { BoundarySmoothingOptions } from "../theme";
import type { Coordinate, PolygonGeometry, PolygonRing } from "./types";
import { clonePolygonGeometry } from "./types";

const DEFAULT_MAX_POINTS = 512;

function lerp(left: number, right: number, amount: number): number {
  return left + (right - left) * amount;
}

function chaikinPoint(
  previous: Coordinate,
  current: Coordinate,
  next: Coordinate,
  strength: number,
): Coordinate[] {
  if (strength <= 0) {
    return [current];
  }

  return [
    {
      x: lerp(current.x, previous.x, strength * 0.25),
      y: lerp(current.y, previous.y, strength * 0.25),
    },
    {
      x: lerp(current.x, next.x, strength * 0.25),
      y: lerp(current.y, next.y, strength * 0.25),
    },
  ];
}

function smoothRing(
  ring: PolygonRing,
  options: BoundarySmoothingOptions,
  maxPoints: number,
): PolygonRing {
  if (!options.enabled || ring.points.length < 3 || options.iterations <= 0) {
    return ring;
  }

  let points = ring.points.map((point) => ({ ...point }));

  for (let iteration = 0; iteration < options.iterations; iteration++) {
    const nextPoints: Coordinate[] = [];

    for (let index = 0; index < points.length; index++) {
      const previous = points[(index - 1 + points.length) % points.length]!;
      const current = points[index]!;
      const next = points[(index + 1) % points.length]!;
      nextPoints.push(...chaikinPoint(previous, current, next, options.strength));
    }

    points = nextPoints.slice(0, maxPoints);

    if (points.length < 3) {
      break;
    }
  }

  return { points };
}

export function smoothPolygonBoundary(
  geometry: PolygonGeometry,
  options: BoundarySmoothingOptions,
  maxPoints = DEFAULT_MAX_POINTS,
): PolygonGeometry {
  if (!options.enabled) {
    return clonePolygonGeometry(geometry);
  }

  return {
    rings: geometry.rings.map((ring) => smoothRing(ring, options, maxPoints)),
  };
}

export function getDefaultSmoothingForTerrain(
  terrain: string,
): BoundarySmoothingOptions {
  switch (terrain) {
    case "water":
    case "forest":
    case "grassland":
    case "desert":
      return { enabled: true, iterations: 2, strength: 0.45, preserveCorners: false };
    case "urban":
    case "chasm":
    case "mountain":
      return { enabled: false, iterations: 0, strength: 0 };
    default:
      return { enabled: true, iterations: 1, strength: 0.25 };
  }
}
