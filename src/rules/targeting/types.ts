import type { TravelRouteType } from "../../networks/networkTypes";
import type { CardDefinition } from "../../cards/cardTypes";
import type {
  SettlementTier,
  TerrainType,
  WorldAction,
  WorldState,
} from "../../world/worldTypes";

export type TargetOriginDefinition =
  | { type: "primary-selection" }
  | { type: "secondary-selection" }
  | { type: "previously-affected-tile" }
  | { type: "previous-action-target" }
  | { type: "random-existing-tile" }
  | { type: "random-boundary-tile" }
  | { type: "world-centre" }
  | {
      type: "nearest-settlement";
      settlementTier?: SettlementTier | "village";
    }
  | {
      type: "specific-coordinate";
      x: number;
      y: number;
    };

export type NumberDefinition =
  | { type: "fixed"; value: number }
  | { type: "random-range"; minimum: number; maximum: number }
  | { type: "card-value" }
  | { type: "previous-action-size" }
  | { type: "connected-region-size" }
  | {
      type: "settlement-tier-value";
      values: Partial<Record<SettlementTier | "village", number>>;
      fallback: number;
    };

export type CardinalDirection = "north" | "east" | "south" | "west";

export type DiagonalDirection =
  | "north-east"
  | "south-east"
  | "south-west"
  | "north-west";

export type DirectionDefinition =
  | { type: "fixed"; value: CardinalDirection | DiagonalDirection }
  | { type: "random-cardinal" }
  | { type: "random-all" }
  | { type: "toward-world-centre" }
  | { type: "away-from-world-centre" }
  | { type: "toward-nearest-settlement" }
  | { type: "away-from-nearest-settlement" }
  | { type: "clockwise-from-previous" }
  | { type: "counter-clockwise-from-previous" };

export type RegionMatchDefinition =
  | { type: "same-terrain-as-origin" }
  | { type: "terrain"; terrain: TerrainType }
  | { type: "same-tag"; tag: string }
  | { type: "settlement-tiles" }
  | { type: "ruin-tiles" }
  | { type: "road-network"; routeType?: TravelRouteType };

export type TargetSearchDefinition =
  | { type: "origin-only" }
  | {
      type: "adjacent";
      mode?: "cardinal" | "diagonal" | "all";
    }
  | {
      type: "within-distance";
      distance: NumberDefinition;
      metric?: "manhattan" | "chebyshev";
      includeOrigin?: boolean;
    }
  | {
      type: "exact-distance";
      distance: NumberDefinition;
      metric?: "manhattan" | "chebyshev";
    }
  | {
      type: "direction";
      direction: DirectionDefinition;
      distance: NumberDefinition;
    }
  | {
      type: "connected-region";
      connection?: "cardinal" | "all";
      match: RegionMatchDefinition;
    }
  | {
      type: "nearest";
      maximumDistance?: number;
    }
  | {
      type: "map-boundary";
    }
  | {
      type: "along-route";
      routeType?: TravelRouteType;
      maximumSteps?: NumberDefinition;
    };

export type TargetFilterDefinition =
  | { type: "tile-exists" }
  | { type: "tile-missing" }
  | { type: "terrain-is"; terrain: TerrainType }
  | { type: "terrain-is-not"; terrain: TerrainType }
  | { type: "terrain-in"; terrains: TerrainType[] }
  | { type: "has-tag"; tag: string }
  | { type: "does-not-have-tag"; tag: string }
  | { type: "has-settlement" }
  | { type: "has-no-settlement" }
  | {
      type: "settlement-tier-is";
      tier: SettlementTier | "village" | "ruin";
    }
  | {
      type: "settlement-region-tier-in";
      tiers: SettlementTier[];
    }
  | {
      type: "adjacent-to-terrain";
      terrain: TerrainType;
      mode?: "cardinal" | "all";
    }
  | {
      type: "minimum-neighbours";
      terrain: TerrainType;
      count: number;
      mode?: "cardinal" | "all";
    }
  | { type: "is-boundary-tile" }
  | { type: "is-connected-to-road" }
  | { type: "is-not-connected-to-road" }
  | {
      type: "distance-from-origin";
      minimum?: number;
      maximum?: number;
      metric?: "manhattan" | "chebyshev";
    }
  | {
      type: "distance-from-world-centre";
      minimum?: number;
      maximum?: number;
      metric?: "manhattan" | "chebyshev";
    };

export type TargetOrderingDefinition =
  | { type: "coordinate" }
  | { type: "nearest-to-origin" }
  | { type: "farthest-from-origin" }
  | { type: "lowest-terrain-cost"; routeType?: TravelRouteType }
  | { type: "highest-settlement-tier" }
  | { type: "lowest-settlement-tier" }
  | { type: "random" };

export type TargetSelectionDefinition =
  | { type: "all" }
  | { type: "first" }
  | { type: "count"; count: NumberDefinition }
  | { type: "random-one" }
  | { type: "random-count"; count: NumberDefinition }
  | { type: "nearest-one" }
  | { type: "farthest-one" };

export type TargetExpansionDefinition =
  | { type: "none" }
  | {
      type: "plus";
      radius: NumberDefinition;
      includeCentre?: boolean;
    }
  | {
      type: "square";
      radius: NumberDefinition;
      includeCentre?: boolean;
    }
  | {
      type: "diamond";
      radius: NumberDefinition;
      includeCentre?: boolean;
    }
  | {
      type: "line";
      direction: DirectionDefinition;
      length: NumberDefinition;
      includeOrigin?: boolean;
    }
  | {
      type: "ring";
      radius: NumberDefinition;
      metric?: "manhattan" | "chebyshev";
    }
  | {
      type: "connected-region";
      connection?: "cardinal" | "all";
      match: RegionMatchDefinition;
    }
  | {
      type: "random-walk";
      steps: NumberDefinition;
      mode?: "cardinal" | "all";
      allowRevisit?: boolean;
    };

export type TargetRequirementDefinition =
  | { type: "minimum-target-count"; count: number }
  | { type: "maximum-target-count"; count: number }
  | { type: "all-targets-must-exist" }
  | { type: "all-targets-must-be-missing" }
  | { type: "targets-must-be-connected"; mode?: "cardinal" | "all" }
  | { type: "must-include-boundary-tile" }
  | { type: "must-not-overlap-route"; routeType?: TravelRouteType };

export interface TargetDefinition {
  origin: TargetOriginDefinition;
  /** Second endpoint for two-point route cards. */
  destination?: TargetOriginDefinition;
  search?: TargetSearchDefinition;
  filters?: TargetFilterDefinition[];
  ordering?: TargetOrderingDefinition;
  selection?: TargetSelectionDefinition;
  expansion?: TargetExpansionDefinition;
  requirements?: TargetRequirementDefinition[];
}

export interface TargetResolutionContext {
  world: WorldState;
  card: CardDefinition;
  primarySelectionId?: string;
  secondarySelectionId?: string;
  currentActionTargetIds?: string[];
  previousAction?: WorldAction;
  randomSeed: string;
}

export interface TargetResolutionResult {
  valid: boolean;
  originIds: string[];
  destinationIds: string[];
  candidateIds: string[];
  filteredCandidateIds: string[];
  selectedIds: string[];
  expandedTargetIds: string[];
  validationMessages: string[];
  resolvedValues: Record<string, unknown>;
}

export interface TargetResolutionRecord {
  originIds: string[];
  destinationIds: string[];
  selectedIds: string[];
  expandedTargetIds: string[];
  resolvedValues: Record<string, unknown>;
}

export function createEmptyTargetResult(
  resolvedValues: Record<string, unknown> = {},
): TargetResolutionResult {
  return {
    valid: true,
    originIds: [],
    destinationIds: [],
    candidateIds: [],
    filteredCandidateIds: [],
    selectedIds: [],
    expandedTargetIds: [],
    validationMessages: [],
    resolvedValues,
  };
}

export function createInvalidTargetResult(
  messages: string[],
  partial: Partial<TargetResolutionResult> = {},
): TargetResolutionResult {
  return {
    ...createEmptyTargetResult(partial.resolvedValues),
    ...partial,
    valid: false,
    validationMessages: messages,
  };
}
