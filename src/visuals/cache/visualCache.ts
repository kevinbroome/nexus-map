import type { WorldState } from "../../world/worldTypes";
import { buildVisualTerrainRegions } from "../geometry/terrainRegions";
import type { VisualTerrainRegion } from "../geometry/terrainRegions";
import { buildRouteSegmentIndex, type RouteSegmentVisual } from "../geometry/routeGeometry";

export interface VisualWorldSnapshot {
  cacheKey: string;
  terrainRegions: VisualTerrainRegion[];
  routeSegments: RouteSegmentVisual[];
}

export function buildVisualWorldCacheKey(world: WorldState): string {
  return `${world.id}:${world.updatedAt}:${world.turn}:${Object.keys(world.tiles).length}:${Object.keys(world.travelRoutes).length}`;
}

export function buildVisualWorldSnapshot(world: WorldState): VisualWorldSnapshot {
  return {
    cacheKey: buildVisualWorldCacheKey(world),
    terrainRegions: buildVisualTerrainRegions(world),
    routeSegments: buildRouteSegmentIndex(world.travelRoutes),
  };
}

const snapshotCache = new Map<string, VisualWorldSnapshot>();

export function getVisualWorldSnapshot(world: WorldState): VisualWorldSnapshot {
  const cacheKey = buildVisualWorldCacheKey(world);
  const cached = snapshotCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const snapshot = buildVisualWorldSnapshot(world);
  snapshotCache.set(cacheKey, snapshot);

  if (snapshotCache.size > 12) {
    const oldestKey = snapshotCache.keys().next().value;

    if (oldestKey) {
      snapshotCache.delete(oldestKey);
    }
  }

  return snapshot;
}

export function clearVisualWorldSnapshotCache(): void {
  snapshotCache.clear();
}
