import type { Coordinate, PolygonGeometry, PolygonRing } from "./types";
import { compareCoordinates, coordinateKey, normalizeRingOrientation } from "./types";

type Edge = {
  start: Coordinate;
  end: Coordinate;
};

function parseTileId(tileId: string): Coordinate {
  const [xText, yText] = tileId.split(",");
  return { x: Number(xText), y: Number(yText) };
}

function edgeKey(edge: Edge): string {
  const startKey = coordinateKey(edge.start);
  const endKey = coordinateKey(edge.end);
  return startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

function collectBoundaryEdges(tileIds: string[]): Edge[] {
  const tileSet = new Set(tileIds);
  const edges: Edge[] = [];

  for (const tileId of tileIds) {
    const { x, y } = parseTileId(tileId);
    const sides: Array<{ neighborId: string; edge: Edge }> = [
      { neighborId: `${x},${y - 1}`, edge: { start: { x, y }, end: { x: x + 1, y } } },
      {
        neighborId: `${x + 1},${y}`,
        edge: { start: { x: x + 1, y }, end: { x: x + 1, y: y + 1 } },
      },
      {
        neighborId: `${x},${y + 1}`,
        edge: { start: { x: x + 1, y: y + 1 }, end: { x, y: y + 1 } },
      },
      { neighborId: `${x - 1},${y}`, edge: { start: { x, y: y + 1 }, end: { x, y } } },
    ];

    for (const side of sides) {
      if (!tileSet.has(side.neighborId)) {
        edges.push(side.edge);
      }
    }
  }

  const unique = new Map<string, Edge>();

  for (const edge of edges) {
    unique.set(edgeKey(edge), edge);
  }

  return [...unique.values()];
}

function nextPoint(current: Coordinate, edgesByStart: Map<string, Edge[]>): Coordinate | null {
  const options = edgesByStart.get(coordinateKey(current));

  if (!options || options.length === 0) {
    return null;
  }

  options.sort((left, right) => compareCoordinates(left.end, right.end));
  const edge = options.shift()!;

  if (options.length === 0) {
    edgesByStart.delete(coordinateKey(current));
  }

  return edge.end;
}

function chainEdgesIntoRing(edges: Edge[]): PolygonRing | null {
  if (edges.length === 0) {
    return null;
  }

  const edgesByStart = new Map<string, Edge[]>();

  for (const edge of edges) {
    const key = coordinateKey(edge.start);
    const bucket = edgesByStart.get(key) ?? [];
    bucket.push(edge);
    edgesByStart.set(key, bucket);
  }

  const start = [...edges]
    .map((edge) => edge.start)
    .sort(compareCoordinates)[0]!;

  const points: Coordinate[] = [start];
  let current = start;
  const maxSteps = edges.length + 4;

  for (let step = 0; step < maxSteps; step++) {
    const next = nextPoint(current, edgesByStart);

    if (!next) {
      break;
    }

    if (
      next.x === start.x &&
      next.y === start.y &&
      points.length >= 3
    ) {
      break;
    }

    points.push(next);
    current = next;
  }

  if (points.length < 3) {
    return null;
  }

  return normalizeRingOrientation({ points });
}

export function traceTerrainRegionBoundary(tileIds: string[]): PolygonGeometry {
  const sortedTileIds = [...tileIds].sort((left, right) => left.localeCompare(right));

  if (sortedTileIds.length === 0) {
    return { rings: [] };
  }

  if (sortedTileIds.length === 1) {
    const { x, y } = parseTileId(sortedTileIds[0]!);
    return {
      rings: [
        normalizeRingOrientation({
          points: [
            { x, y },
            { x: x + 1, y },
            { x: x + 1, y: y + 1 },
            { x, y: y + 1 },
          ],
        }),
      ],
    };
  }

  const edges = collectBoundaryEdges(sortedTileIds);
  const ring = chainEdgesIntoRing(edges);

  return {
    rings: ring ? [ring] : [],
  };
}
