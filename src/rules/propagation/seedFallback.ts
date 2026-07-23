import { getTileId } from "../../world/coordinates";
import { getWorldCentreTileId } from "../targeting/directions";
import { sortTileIds, manhattanDistance } from "../targeting/utils";
import { getExistingNeighbourIds } from "../../world/neighbours";
import type { MapTile, TerrainType, TileChange, WorldState } from "../../world/worldTypes";
import { cloneTile, normalizeMapTile } from "../../world/tileUtils";
import type { PropagationContext, PropagationResult, SeedFallbackDefinition } from "./types";
import { createSeededRandom } from "../random";

function cloneWorldTiles(world: WorldState): WorldState {
  return {
    ...world,
    tiles: Object.fromEntries(
      Object.entries(world.tiles).map(([tileId, tile]) => [tileId, cloneTile(tile)]),
    ),
  };
}

function isValidHost(
  tile: MapTile | undefined,
  hosts: TerrainType[] | undefined,
): tile is MapTile {
  if (!tile) {
    return false;
  }

  if (!hosts || hosts.length === 0) {
    return true;
  }

  return hosts.includes(tile.terrain);
}

function pickNearCentreHostIds(
  world: WorldState,
  hosts: TerrainType[] | undefined,
  count: number,
  randomSeed: string,
): string[] {
  const centreId = getWorldCentreTileId(world);
  const candidates = sortTileIds(
    Object.keys(world.tiles).filter((tileId) =>
      isValidHost(world.tiles[tileId], hosts),
    ),
  );

  candidates.sort((left, right) => {
    const leftDistance = manhattanDistance(left, centreId);
    const rightDistance = manhattanDistance(right, centreId);

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    return left.localeCompare(right, undefined, { numeric: true });
  });

  if (candidates.length === 0) {
    return [];
  }

  const random = createSeededRandom(`${randomSeed}:seed-fallback`);
  const picked: string[] = [];
  const pool = [...candidates];

  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(random() * Math.min(pool.length, 3));
    picked.push(pool.splice(index, 1)[0]!);
  }

  return picked;
}

function pickAdjacentHostIds(
  world: WorldState,
  anchorId: string,
  hosts: TerrainType[] | undefined,
  count: number,
  randomSeed: string,
): string[] {
  const anchor = world.tiles[anchorId];

  if (!anchor) {
    return [];
  }

  const neighbours = getExistingNeighbourIds(world, anchor, "cardinal").filter(
    (tileId) => isValidHost(world.tiles[tileId], hosts),
  );

  if (neighbours.length === 0) {
    return pickNearCentreHostIds(world, hosts, count, randomSeed);
  }

  const random = createSeededRandom(`${randomSeed}:seed-fallback-adjacent`);
  const picked: string[] = [];
  const pool = [...neighbours];

  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(random() * pool.length);
    picked.push(pool.splice(index, 1)[0]!);
  }

  return picked;
}

export function propagationNeedsSeedFallback(
  world: WorldState,
  sourceTerrain: TerrainType | undefined,
): boolean {
  if (!sourceTerrain) {
    return false;
  }

  return !Object.values(world.tiles).some((tile) => tile.terrain === sourceTerrain);
}

export function applySeedFallback(
  world: WorldState,
  fallback: SeedFallbackDefinition,
  context: PropagationContext,
): PropagationResult {
  const workingWorld = cloneWorldTiles(world);
  const tileCount = fallback.tileCount ?? 1;

  let hostIds =
    fallback.anchor === "primary-selection" && context.seedTileIds[0]
      ? [context.seedTileIds[0], ...pickAdjacentHostIds(
          workingWorld,
          context.seedTileIds[0],
          fallback.validHostTerrains,
          Math.max(0, tileCount - 1),
          context.randomSeed,
        )]
      : pickNearCentreHostIds(
          workingWorld,
          fallback.validHostTerrains,
          tileCount,
          context.randomSeed,
        );

  hostIds = [...new Set(hostIds)].slice(0, tileCount);

  if (hostIds.length === 0) {
    return {
      valid: false,
      seedTileIds: [],
      affectedTileIds: [],
      createdTileIds: [],
      traversedTileIds: [],
      blockedTileIds: [],
      steps: [],
      tileChanges: [],
      validationMessages: ["No valid tiles were available for the biome seed fallback."],
      resolvedValues: { seedFallbackApplied: false },
    };
  }

  const tileChanges: TileChange[] = [];
  const affectedTileIds: string[] = [];

  for (const tileId of hostIds) {
    const before = world.tiles[tileId];

    if (!before) {
      continue;
    }

    const after = cloneTile(before);
    after.terrain = fallback.terrain;

    if (fallback.terrain === "water") {
      delete after.settlement;
    }

    workingWorld.tiles[tileId] = after;
    affectedTileIds.push(tileId);
    tileChanges.push({
      tileId,
      before: cloneTile(before),
      after: cloneTile(after),
    });
  }

  if (fallback.companionTerrain) {
    const companionIds = pickAdjacentHostIds(
      workingWorld,
      hostIds[0]!,
      fallback.companionTerrain.validHostTerrains ?? ["empty", "grassland", "desert"],
      fallback.companionTerrain.count,
      `${context.randomSeed}:companion`,
    );

    for (const tileId of companionIds) {
      const before = world.tiles[tileId] ?? workingWorld.tiles[tileId];

      if (!before) {
        continue;
      }

      const after = cloneTile(before);
      after.terrain = fallback.companionTerrain.terrain;
      workingWorld.tiles[tileId] = after;
      affectedTileIds.push(tileId);
      tileChanges.push({
        tileId,
        before: cloneTile(before),
        after: cloneTile(after),
      });
    }
  }

  return {
    valid: true,
    seedTileIds: sortTileIds(hostIds),
    affectedTileIds: sortTileIds([...new Set(affectedTileIds)]),
    createdTileIds: [],
    traversedTileIds: sortTileIds([...new Set(affectedTileIds)]),
    blockedTileIds: [],
    steps: [],
    tileChanges,
    validationMessages: [],
    resolvedValues: {
      seedFallbackApplied: true,
      seedFallbackTerrain: fallback.terrain,
    },
  };
}

export function ensurePrimarySelectionTile(
  world: WorldState,
  tileId: string,
  terrain: TerrainType,
): { world: WorldState; change: TileChange | null } {
  const before = world.tiles[tileId];

  if (!before) {
    return { world, change: null };
  }

  const after = cloneTile(before);
  after.terrain = terrain;

  if (terrain === "water") {
    delete after.settlement;
  }

  return {
    world: {
      ...world,
      tiles: {
        ...world.tiles,
        [tileId]: after,
      },
    },
    change: {
      tileId,
      before: cloneTile(before),
      after: cloneTile(after),
    },
  };
}

export function createTileAtCoordinate(
  world: WorldState,
  x: number,
  y: number,
  terrain: TerrainType,
): { world: WorldState; tileId: string; change: TileChange } {
  const tileId = getTileId(x, y);
  const after = normalizeMapTile({
    id: tileId,
    x,
    y,
    terrain,
    tags: [],
    properties: {},
  });

  return {
    world: {
      ...world,
      tiles: {
        ...world.tiles,
        [tileId]: after,
      },
    },
    tileId,
    change: {
      tileId,
      before: null,
      after: cloneTile(after),
    },
  };
}
