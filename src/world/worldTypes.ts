import type { TravelRoute } from "../networks/networkTypes";
import type { DeckMutationRecord, DeckState } from "../deck/deckTypes";
import type { FailureAttemptRecord } from "../rules/failure/failureTypes";

export type TerrainType =
  | "empty"
  | "water"
  | "grassland"
  | "forest"
  | "mountain"
  | "urban"
  | "chasm"
  | "desert";

export interface VillageSettlement {
  type: "village";
  inhospitableTurns: number;
  name?: string;
}

export interface RuinSettlement {
  type: "ruin";
  formerType: "village";
  ruinedAtTurn: number;
}

export type Settlement = VillageSettlement | RuinSettlement;

export function isVillageSettlement(
  settlement: Settlement | undefined,
): settlement is VillageSettlement {
  return settlement?.type === "village";
}

export function isRuinSettlement(
  settlement: Settlement | undefined,
): settlement is RuinSettlement {
  return settlement?.type === "ruin";
}

/** @deprecated Use isVillageSettlement for world-law logic. Kept for neighbour helpers. */
export type SettlementType = "village" | "town" | "city" | "ruin";

export interface MapTile {
  id: string;
  x: number;
  y: number;
  terrain: TerrainType;
  settlement?: Settlement;
  tags: string[];
  properties: Record<string, string | number | boolean>;
}

export interface TileChange {
  tileId: string;
  before: MapTile | null;
  after: MapTile;
}

export type SettlementTier =
  | "town"
  | "expanse"
  | "urban-region"
  | "quadrant"
  | "sunder";

export interface SettlementRegion {
  id: string;
  tier: SettlementTier;
  childIds: string[];
  memberTileIds: string[];
  anchorTileId: string;
  createdTurn: number;
}

export type WorldConsequence =
  | {
      type: "village-decline-advanced";
      tileId: string;
      previousTurns: number;
      currentTurns: number;
    }
  | {
      type: "village-became-ruin";
      tileId: string;
      turn: number;
    }
  | {
      type: "settlement-region-formed";
      regionId: string;
      tier: SettlementTier;
      childIds: string[];
      memberTileIds: string[];
    }
  | {
      type: "settlement-region-dissolved";
      regionId: string;
      tier: SettlementTier;
      memberTileIds: string[];
    };

export interface SettlementRegionChange {
  regionId: string;
  tier: SettlementTier;
  before: SettlementRegion | null;
  after: SettlementRegion | null;
}

export type { RouteChange, TravelRoute } from "../networks/networkTypes";
import type { RouteChange } from "../networks/networkTypes";

import type { PropagationRecord } from "../rules/propagation/types";
import type { TargetResolutionRecord } from "../rules/targeting/types";

export interface WorldAction {
  id: string;
  sequence: number;
  cardId: string;
  cardName: string;
  cardInstanceId: string;
  effectiveCardDefinitionSummary: Record<string, unknown>;
  failureAttempts: FailureAttemptRecord[];
  deckMutations: DeckMutationRecord[];
  targetIds: string[];
  targetResolution: TargetResolutionRecord;
  propagationRecords: PropagationRecord[];
  appliedAt: string;
  changes: TileChange[];
  randomSeed: string;
  resolvedValues: Record<string, unknown>;
  turn: number;
  consequences: WorldConsequence[];
  regionChanges: SettlementRegionChange[];
  routeChanges: RouteChange[];
}

export interface WorldState {
  version: 6;
  id: string;
  name: string;
  turn: number;
  tiles: Record<string, MapTile>;
  settlementRegions: Record<string, SettlementRegion>;
  travelRoutes: Record<string, TravelRoute>;
  deck: DeckState;
  deckConfigurationId: string;
  history: WorldAction[];
  createdAt: string;
  updatedAt: string;
}

export const CURRENT_WORLD_VERSION = 6 as const;

export type LegacyWorldStateV5 = {
  version: 5;
  id: string;
  name: string;
  turn: number;
  tiles: Record<string, MapTile>;
  settlementRegions: Record<string, SettlementRegion>;
  travelRoutes: Record<string, TravelRoute>;
  deck: DeckState;
  history: WorldAction[];
  createdAt: string;
  updatedAt: string;
};

export type LegacyWorldStateV4 = {
  version: 4;
  id: string;
  name: string;
  turn: number;
  tiles: Record<string, MapTile>;
  settlementRegions: Record<string, SettlementRegion>;
  travelRoutes: Record<string, TravelRoute>;
  history: WorldAction[];
  createdAt: string;
  updatedAt: string;
};

export type LegacyWorldStateV1 = {
  version: 1;
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: Record<string, MapTile>;
  history: WorldAction[];
  createdAt: string;
  updatedAt: string;
};

export type LegacyWorldStateV2 = {
  version: 2;
  id: string;
  name: string;
  tiles: Record<string, MapTile>;
  history: WorldAction[];
  createdAt: string;
  updatedAt: string;
};

export type LegacyWorldStateV3 = {
  version: 3;
  id: string;
  name: string;
  turn: number;
  tiles: Record<string, MapTile>;
  settlementRegions: Record<string, SettlementRegion>;
  history: WorldAction[];
  createdAt: string;
  updatedAt: string;
};
