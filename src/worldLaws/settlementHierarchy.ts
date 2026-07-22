import { getExistingNeighbourIds } from "../world/neighbours";
import type {
  MapTile,
  SettlementRegion,
  SettlementTier,
  WorldState,
} from "../world/worldTypes";
import { isVillageSettlement } from "../world/worldTypes";
import { SETTLEMENT_THRESHOLDS } from "./constants";
import { groupConnectedUnits } from "./groupConnectedUnits";
import { createRegionId } from "./regionId";

function compareTiles(left: MapTile, right: MapTile): number {
  if (left.y !== right.y) {
    return left.y - right.y;
  }

  return left.x - right.x;
}

function getAnchorTileId(tileIds: string[], tiles: Record<string, MapTile>): string {
  const sorted = tileIds
    .map((tileId) => tiles[tileId])
    .filter((tile): tile is MapTile => tile !== undefined)
    .sort(compareTiles);

  return sorted[0]?.id ?? tileIds.sort()[0]!;
}

function areTilesCardinallyAdjacent(
  world: WorldState,
  firstTileId: string,
  secondTileId: string,
): boolean {
  const neighbourIds = getExistingNeighbourIds(
    world,
    world.tiles[firstTileId]!,
    "cardinal",
  );

  return neighbourIds.includes(secondTileId);
}

function areVillagesConnected(
  world: WorldState,
  first: MapTile,
  second: MapTile,
): boolean {
  return areTilesCardinallyAdjacent(world, first.id, second.id);
}

function areRegionsConnected(
  world: WorldState,
  first: SettlementRegion,
  second: SettlementRegion,
): boolean {
  for (const firstTileId of first.memberTileIds) {
    for (const secondTileId of second.memberTileIds) {
      if (areTilesCardinallyAdjacent(world, firstTileId, secondTileId)) {
        return true;
      }
    }
  }

  return false;
}

function getVillageTiles(world: WorldState): MapTile[] {
  return Object.values(world.tiles)
    .filter((tile) => isVillageSettlement(tile.settlement))
    .sort(compareTiles);
}

function createRegion(
  tier: SettlementTier,
  childIds: string[],
  memberTileIds: string[],
  tiles: Record<string, MapTile>,
  turn: number,
): SettlementRegion {
  const anchorTileId = getAnchorTileId(memberTileIds, tiles);

  return {
    id: createRegionId(tier, childIds),
    tier,
    childIds: [...childIds].sort(),
    memberTileIds: [...memberTileIds].sort(),
    anchorTileId,
    createdTurn: turn,
  };
}

function buildTownRegions(
  world: WorldState,
  turn: number,
): SettlementRegion[] {
  const villages = getVillageTiles(world);
  const groups = groupConnectedUnits(
    villages,
    SETTLEMENT_THRESHOLDS.town,
    (tile) => tile.id,
    (first, second) => areVillagesConnected(world, first, second),
    compareTiles,
  );

  return groups.map((group) =>
    createRegion(
      "town",
      group.map((tile) => tile.id),
      group.map((tile) => tile.id),
      world.tiles,
      turn,
    ),
  );
}

function compareRegions(
  world: WorldState,
  left: SettlementRegion,
  right: SettlementRegion,
): number {
  const leftAnchor = world.tiles[left.anchorTileId];
  const rightAnchor = world.tiles[right.anchorTileId];

  if (leftAnchor && rightAnchor) {
    return compareTiles(leftAnchor, rightAnchor);
  }

  return left.id.localeCompare(right.id);
}

function buildHigherTierRegions(
  world: WorldState,
  turn: number,
  tier: SettlementTier,
  threshold: number,
  childRegions: SettlementRegion[],
): SettlementRegion[] {
  const groups = groupConnectedUnits(
    childRegions,
    threshold,
    (region) => region.id,
    (first, second) => areRegionsConnected(world, first, second),
    (left, right) => compareRegions(world, left, right),
  );

  return groups.map((group) => {
    const childIds = group.map((region) => region.id);
    const memberTileIds = group.flatMap((region) => region.memberTileIds);

    return createRegion(tier, childIds, memberTileIds, world.tiles, turn);
  });
}

/**
 * Rebuilds the full settlement hierarchy from active village tiles.
 * Uses a deterministic greedy partitioning algorithm at each tier.
 */
export function buildSettlementHierarchy(
  world: WorldState,
  turn: number,
): Record<string, SettlementRegion> {
  const towns = buildTownRegions(world, turn);
  const expanses = buildHigherTierRegions(
    world,
    turn,
    "expanse",
    SETTLEMENT_THRESHOLDS.expanse,
    towns,
  );
  const urbans = buildHigherTierRegions(
    world,
    turn,
    "urban-region",
    SETTLEMENT_THRESHOLDS.urbanRegion,
    expanses,
  );
  const quadrants = buildHigherTierRegions(
    world,
    turn,
    "quadrant",
    SETTLEMENT_THRESHOLDS.quadrant,
    urbans,
  );
  const sunders = buildHigherTierRegions(
    world,
    turn,
    "sunder",
    SETTLEMENT_THRESHOLDS.sunder,
    quadrants,
  );

  const regions = [...towns, ...expanses, ...urbans, ...quadrants, ...sunders];

  return Object.fromEntries(regions.map((region) => [region.id, region]));
}

export function findRegionsContainingTile(
  regions: Record<string, SettlementRegion>,
  tileId: string,
): SettlementRegion[] {
  return Object.values(regions).filter((region) =>
    region.memberTileIds.includes(tileId),
  );
}

export function findRegionForTileAtTier(
  regions: Record<string, SettlementRegion>,
  tileId: string,
  tier: SettlementTier,
): SettlementRegion | undefined {
  return findRegionsContainingTile(regions, tileId).find(
    (region) => region.tier === tier,
  );
}
