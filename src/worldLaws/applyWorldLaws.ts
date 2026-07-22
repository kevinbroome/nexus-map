import type {
  SettlementRegion,
  SettlementRegionChange,
  SettlementTier,
  TileChange,
  WorldConsequence,
  WorldState,
} from "../world/worldTypes";
import { cloneTile } from "../world/tileUtils";
import { findRuinClusters } from "./ruinClusters";
import { buildSettlementHierarchy } from "./settlementHierarchy";
import { applyVillageDecline } from "./villageDecline";

export interface WorldLawResult {
  world: WorldState;
  consequences: WorldConsequence[];
  tileChanges: TileChange[];
  regionChanges: SettlementRegionChange[];
  ruinClusters: string[][];
}

function sortConsequences(consequences: WorldConsequence[]): WorldConsequence[] {
  return [...consequences].sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right)),
  );
}

function buildRegionChanges(
  previousRegions: Record<string, SettlementRegion>,
  nextRegions: Record<string, SettlementRegion>,
): {
  regionChanges: SettlementRegionChange[];
  consequences: WorldConsequence[];
} {
  const regionChanges: SettlementRegionChange[] = [];
  const consequences: WorldConsequence[] = [];
  const allRegionIds = new Set([
    ...Object.keys(previousRegions),
    ...Object.keys(nextRegions),
  ]);

  for (const regionId of [...allRegionIds].sort()) {
    const before = previousRegions[regionId] ?? null;
    const after = nextRegions[regionId] ?? null;

    if (before === after) {
      continue;
    }

    if (before && after) {
      const beforeKey = JSON.stringify(before);
      const afterKey = JSON.stringify(after);

      if (beforeKey === afterKey) {
        continue;
      }
    }

    const tier = (after ?? before)!.tier;

    regionChanges.push({
      regionId,
      tier,
      before,
      after,
    });

    if (!before && after) {
      consequences.push({
        type: "settlement-region-formed",
        regionId: after.id,
        tier: after.tier,
        childIds: after.childIds,
        memberTileIds: after.memberTileIds,
      });
    } else if (before && !after) {
      consequences.push({
        type: "settlement-region-dissolved",
        regionId: before.id,
        tier: before.tier,
        memberTileIds: before.memberTileIds,
      });
    } else if (before && after) {
      consequences.push({
        type: "settlement-region-dissolved",
        regionId: before.id,
        tier: before.tier,
        memberTileIds: before.memberTileIds,
      });
      consequences.push({
        type: "settlement-region-formed",
        regionId: after.id,
        tier: after.tier,
        childIds: after.childIds,
        memberTileIds: after.memberTileIds,
      });
    }
  }

  regionChanges.sort((left, right) => left.regionId.localeCompare(right.regionId));

  return { regionChanges, consequences };
}

function buildTileChanges(
  previousWorld: WorldState,
  nextTiles: Record<string, import("../world/worldTypes").MapTile>,
): TileChange[] {
  const changes: TileChange[] = [];

  for (const [tileId, after] of Object.entries(nextTiles)) {
    const before = previousWorld.tiles[tileId];

    if (!before) {
      continue;
    }

    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push({
        tileId,
        before: cloneTile(before),
        after: cloneTile(after),
      });
    }
  }

  changes.sort((left, right) => left.tileId.localeCompare(right.tileId));

  return changes;
}

export function applyWorldLaws(
  previousWorld: WorldState,
  postCardWorld: WorldState,
  nextTurn: number,
): WorldLawResult {
  const declineResult = applyVillageDecline(postCardWorld, nextTurn);
  const worldAfterDecline: WorldState = {
    ...postCardWorld,
    tiles: declineResult.tiles,
    turn: nextTurn,
  };

  const nextRegions = buildSettlementHierarchy(worldAfterDecline, nextTurn);
  const { regionChanges, consequences: regionConsequences } = buildRegionChanges(
    previousWorld.settlementRegions,
    nextRegions,
  );

  const world: WorldState = {
    ...worldAfterDecline,
    settlementRegions: nextRegions,
    travelRoutes: postCardWorld.travelRoutes,
  };

  const lawTileChanges = buildTileChanges(postCardWorld, world.tiles);
  const consequences = sortConsequences([
    ...declineResult.consequences,
    ...regionConsequences,
  ]);
  const ruinClusters = findRuinClusters(world).map((cluster) =>
    cluster.map((tile) => tile.id),
  );

  return {
    world,
    consequences,
    tileChanges: lawTileChanges,
    regionChanges,
    ruinClusters,
  };
}

export function countRegionsByTier(
  regions: Record<string, SettlementRegion>,
  tier: SettlementTier,
): number {
  return Object.values(regions).filter((region) => region.tier === tier).length;
}
