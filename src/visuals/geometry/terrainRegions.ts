import { getExistingTiles } from "../../world/coordinates";
import { getConnectedRegion, matchesTerrain } from "../../world/neighbours";
import type { TerrainType, WorldState } from "../../world/worldTypes";
import { traceTerrainRegionBoundary } from "./boundaryTracing";
import type { Coordinate } from "./types";

/** Lower values render first; broad base terrains must sit under inset features. */
const TERRAIN_RENDER_PRIORITY: Record<TerrainType, number> = {
  empty: 0,
  grassland: 1,
  desert: 2,
  forest: 3,
  mountain: 4,
  urban: 5,
  water: 6,
  chasm: 7,
};

export function compareTerrainRenderOrder(
  left: Pick<VisualTerrainRegion, "terrain" | "id">,
  right: Pick<VisualTerrainRegion, "terrain" | "id">,
): number {
  const priorityDelta =
    TERRAIN_RENDER_PRIORITY[left.terrain] - TERRAIN_RENDER_PRIORITY[right.terrain];

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return left.id.localeCompare(right.id);
}

export interface VisualTerrainRegion {
  id: string;
  terrain: TerrainType;
  tileIds: string[];
  boundaryCoordinates: Coordinate[];
  boundaryGeometry: ReturnType<typeof traceTerrainRegionBoundary>;
}

function sortTileIds(tileIds: string[]): string[] {
  return [...tileIds].sort((left, right) => left.localeCompare(right));
}

export function buildVisualTerrainRegions(world: WorldState): VisualTerrainRegion[] {
  const visited = new Set<string>();
  const regions: VisualTerrainRegion[] = [];

  const tiles = getExistingTiles(world).sort((left, right) =>
    left.id.localeCompare(right.id),
  );

  for (const tile of tiles) {
    if (visited.has(tile.id)) {
      continue;
    }

    const tileIds = sortTileIds(
      getConnectedRegion(world, tile.id, matchesTerrain(tile.terrain), "cardinal").map(
        (entry) => entry.id,
      ),
    );

    for (const tileId of tileIds) {
      visited.add(tileId);
    }

    const anchorId = tileIds[0] ?? tile.id;
    const boundaryGeometry = traceTerrainRegionBoundary(tileIds);
    const outerRing = boundaryGeometry.rings[0];

    regions.push({
      id: `${tile.terrain}:${anchorId}`,
      terrain: tile.terrain,
      tileIds,
      boundaryCoordinates: outerRing?.points ?? [],
      boundaryGeometry,
    });
  }

  regions.sort(compareTerrainRenderOrder);
  return regions;
}
