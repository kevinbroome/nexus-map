import type {
  ProposedTravelRoute,
  RouteChange,
  TravelNodeType,
} from "../networks/networkTypes";
import type { PropagationRecord, PropagationResult } from "../rules/propagation/types";
import type { PropagatingEffectDefinition } from "../rules/propagation/types";
import type {
  TargetResolutionRecord,
  TargetResolutionResult,
} from "../rules/targeting/types";
import type {
  SettlementRegionChange,
  TerrainType,
  TileChange,
  WorldConsequence,
  WorldState,
} from "../world/worldTypes";

export type ConditionDefinition =
  | { type: "terrain-is"; terrain: TerrainType }
  | { type: "terrain-is-not"; terrain: TerrainType }
  | { type: "has-settlement" }
  | { type: "has-no-settlement" }
  | { type: "adjacent-to-terrain"; terrain: TerrainType }
  | { type: "minimum-neighbours"; terrain: TerrainType; count: number };

export type EffectDefinition =
  | { type: "set-terrain"; terrain: TerrainType }
  | { type: "add-settlement"; settlementType: "village" | "town" | "city" }
  | { type: "upgrade-settlement" }
  | { type: "remove-settlement" }
  | {
      type: "change-neighbouring-terrain";
      terrain: TerrainType;
      count: number;
    }
  | { type: "add-tag"; tag: string }
  | PropagatingEffectDefinition
  | {
      type: "create-travel-route";
      routeType: import("../networks/networkTypes").TravelRouteType;
      destination:
        | { type: "selected-secondary-target" }
        | { type: "nearest-valid-settlement" }
        | { type: "random-valid-settlement" };
      preferExistingNetwork?: boolean;
      allowedNodeTypes?: TravelNodeType[];
    };

export type { PropagatingEffectDefinition } from "../rules/propagation/types";
export type { TargetDefinition } from "../rules/targeting/types";

import type { TargetDefinition } from "../rules/targeting/types";

export interface CardDefinition {
  id: string;
  name: string;
  description: string;
  target: TargetDefinition;
  conditions: ConditionDefinition[];
  effects: EffectDefinition[];
}

export interface ProposedAction {
  cardId: string;
  targetIds: string[];
  valid: boolean;
  validationMessages: string[];
  cardChanges: TileChange[];
  consequenceChanges: TileChange[];
  regionChanges: SettlementRegionChange[];
  routeChanges: RouteChange[];
  consequences: WorldConsequence[];
  proposedRoutes: ProposedTravelRoute[];
  targetResolution: TargetResolutionResult | null;
  propagationResults: PropagationResult[];
  nextTurn: number;
  resultingWorld: WorldState | null;
  randomSeed: string;
  resolvedValues: Record<string, unknown>;
}

export function createInvalidProposal(
  cardId: string,
  targetIds: string[],
  validationMessages: string[],
  randomSeed: string,
  targetResolution: TargetResolutionResult | null = null,
): ProposedAction {
  return {
    cardId,
    targetIds,
    valid: false,
    validationMessages,
    cardChanges: [],
    consequenceChanges: [],
    regionChanges: [],
    routeChanges: [],
    consequences: [],
    proposedRoutes: [],
    targetResolution,
    propagationResults: [],
    nextTurn: 0,
    resultingWorld: null,
    randomSeed,
    resolvedValues: targetResolution?.resolvedValues ?? {},
  };
}

export function cardRequiresTwoEndpoints(card: CardDefinition): boolean {
  return card.target.destination !== undefined;
}

export function toTargetResolutionRecord(
  result: TargetResolutionResult,
): TargetResolutionRecord {
  return {
    originIds: result.originIds,
    destinationIds: result.destinationIds,
    selectedIds: result.selectedIds,
    expandedTargetIds: result.expandedTargetIds,
    resolvedValues: result.resolvedValues,
  };
}

export function toPropagationRecord(
  result: PropagationResult,
  effectIndex: number,
): PropagationRecord {
  return {
    effectIndex,
    seedTileIds: result.seedTileIds,
    affectedTileIds: result.affectedTileIds,
    createdTileIds: result.createdTileIds,
    blockedTileIds: result.blockedTileIds,
    steps: result.steps,
    resolvedValues: result.resolvedValues,
  };
}
