import type { WorldState } from "../world/worldTypes";
import { isRuinSettlement, isVillageSettlement } from "../world/worldTypes";
import { countRegionsByTier } from "./applyWorldLaws";
import { findRuinClusters } from "./ruinClusters";

export type SettlementSummary = {
  turn: number;
  villages: number;
  towns: number;
  expanses: number;
  urbans: number;
  quadrants: number;
  sunders: number;
  ruins: number;
  ruinGroups: number;
};

export function getSettlementSummary(world: WorldState): SettlementSummary {
  const villages = Object.values(world.tiles).filter((tile) =>
    isVillageSettlement(tile.settlement),
  ).length;
  const ruins = Object.values(world.tiles).filter((tile) =>
    isRuinSettlement(tile.settlement),
  ).length;

  return {
    turn: world.turn,
    villages,
    towns: countRegionsByTier(world.settlementRegions, "town"),
    expanses: countRegionsByTier(world.settlementRegions, "expanse"),
    urbans: countRegionsByTier(world.settlementRegions, "urban-region"),
    quadrants: countRegionsByTier(world.settlementRegions, "quadrant"),
    sunders: countRegionsByTier(world.settlementRegions, "sunder"),
    ruins,
    ruinGroups: findRuinClusters(world).length,
  };
}

export function formatSettlementSummary(summary: SettlementSummary): string {
  return [
    `Turn: ${summary.turn}`,
    `Villages: ${summary.villages}`,
    `Towns: ${summary.towns}`,
    `Expanses: ${summary.expanses}`,
    `Urbans: ${summary.urbans}`,
    `Quadrants: ${summary.quadrants}`,
    `Sunders: ${summary.sunders}`,
    `Ruins: ${summary.ruins}`,
    `Ruin groups: ${summary.ruinGroups}`,
  ].join("\n");
}
