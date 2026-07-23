export interface Coordinate {
  x: number;
  y: number;
}

export interface PolygonRing {
  points: Coordinate[];
}

export interface PolygonGeometry {
  rings: PolygonRing[];
}

export function compareCoordinates(left: Coordinate, right: Coordinate): number {
  if (left.y !== right.y) {
    return left.y - right.y;
  }

  return left.x - right.x;
}

export function coordinateKey(point: Coordinate): string {
  return `${point.x},${point.y}`;
}

export function ringArea(ring: PolygonRing): number {
  let area = 0;

  for (let index = 0; index < ring.points.length; index++) {
    const current = ring.points[index]!;
    const next = ring.points[(index + 1) % ring.points.length]!;
    area += current.x * next.y - next.x * current.y;
  }

  return area / 2;
}

export function normalizeRingOrientation(ring: PolygonRing): PolygonRing {
  if (ring.points.length < 3) {
    return ring;
  }

  const area = ringArea(ring);

  if (area >= 0) {
    return ring;
  }

  return {
    points: [...ring.points].reverse(),
  };
}

export function clonePolygonGeometry(geometry: PolygonGeometry): PolygonGeometry {
  return {
    rings: geometry.rings.map((ring) => ({
      points: ring.points.map((point) => ({ ...point })),
    })),
  };
}
