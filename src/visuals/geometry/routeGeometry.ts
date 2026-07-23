import type { TravelRoute, TravelRouteType } from "../../networks/networkTypes";
import type { Coordinate } from "./types";

export interface RouteSegmentVisual {
  fromTileId: string;
  toTileId: string;
  routeIds: string[];
  routeTypes: TravelRouteType[];
}

function parseTileId(tileId: string): Coordinate {
  const [xText, yText] = tileId.split(",");
  return { x: Number(xText), y: Number(yText) };
}

function canonicalSegmentKey(fromTileId: string, toTileId: string): string {
  return fromTileId < toTileId
    ? `${fromTileId}|${toTileId}`
    : `${toTileId}|${fromTileId}`;
}

export function buildRouteSegmentIndex(
  routes: Record<string, TravelRoute>,
): RouteSegmentVisual[] {
  const segments = new Map<string, RouteSegmentVisual>();

  for (const route of Object.values(routes)) {
    for (let index = 0; index < route.pathTileIds.length - 1; index++) {
      const fromTileId = route.pathTileIds[index]!;
      const toTileId = route.pathTileIds[index + 1]!;
      const key = canonicalSegmentKey(fromTileId, toTileId);
      const existing = segments.get(key);

      if (existing) {
        if (!existing.routeIds.includes(route.id)) {
          existing.routeIds.push(route.id);
          existing.routeTypes.push(route.type);
        }
        continue;
      }

      segments.set(key, {
        fromTileId: fromTileId < toTileId ? fromTileId : toTileId,
        toTileId: fromTileId < toTileId ? toTileId : fromTileId,
        routeIds: [route.id],
        routeTypes: [route.type],
      });
    }
  }

  return [...segments.values()].sort((left, right) =>
    canonicalSegmentKey(left.fromTileId, left.toTileId).localeCompare(
      canonicalSegmentKey(right.fromTileId, right.toTileId),
    ),
  );
}

export function tileCenterCoordinate(tileId: string): Coordinate {
  const tile = parseTileId(tileId);
  return { x: tile.x + 0.5, y: tile.y + 0.5 };
}

export function smoothRoutePath(tileIds: string[]): Coordinate[] {
  if (tileIds.length === 0) {
    return [];
  }

  const centers = tileIds.map(tileCenterCoordinate);

  if (centers.length <= 2) {
    return centers;
  }

  const smoothed: Coordinate[] = [centers[0]!];

  for (let index = 1; index < centers.length - 1; index++) {
    const previous = centers[index - 1]!;
    const current = centers[index]!;
    const next = centers[index + 1]!;

    smoothed.push({
      x: (previous.x + current.x * 2 + next.x) / 4,
      y: (previous.y + current.y * 2 + next.y) / 4,
    });
  }

  smoothed.push(centers[centers.length - 1]!);
  return smoothed;
}

export function findRouteIntersections(
  segments: RouteSegmentVisual[],
): Set<string> {
  const degree = new Map<string, number>();

  for (const segment of segments) {
    degree.set(segment.fromTileId, (degree.get(segment.fromTileId) ?? 0) + 1);
    degree.set(segment.toTileId, (degree.get(segment.toTileId) ?? 0) + 1);
  }

  const intersections = new Set<string>();

  for (const [tileId, count] of degree.entries()) {
    if (count >= 3) {
      intersections.add(tileId);
    }
  }

  return intersections;
}

export function findRouteEndpoints(routes: Record<string, TravelRoute>): Set<string> {
  const endpoints = new Set<string>();

  for (const route of Object.values(routes)) {
    const first = route.pathTileIds[0];
    const last = route.pathTileIds[route.pathTileIds.length - 1];

    if (first) {
      endpoints.add(first);
    }

    if (last) {
      endpoints.add(last);
    }
  }

  return endpoints;
}
