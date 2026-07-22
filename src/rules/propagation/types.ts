import type { CardDefinition } from "../../cards/cardTypes";
import type { TravelRouteType } from "../../networks/networkTypes";
import type {
  DirectionDefinition,
  NumberDefinition,
} from "../targeting/types";
import type {
  SettlementTier,
  TerrainType,
  TileChange,
  WorldAction,
  WorldState,
} from "../../world/worldTypes";
import type { Coordinate } from "../../world/neighbours";

export type PropagationOperationDefinition =
  | { type: "set-terrain"; terrain: TerrainType }
  | { type: "add-tag"; tag: string }
  | { type: "remove-tag"; tag: string }
  | { type: "remove-settlement"; leaveRuin?: boolean }
  | { type: "add-overlay"; overlay: string };

export type PropagationStrategyDefinition =
  | { type: "breadth-first"; neighbourMode?: "cardinal" | "all" }
  | { type: "random-frontier"; neighbourMode?: "cardinal" | "all" }
  | { type: "weighted-frontier"; neighbourMode?: "cardinal" | "all" }
  | {
      type: "directional";
      direction: DirectionDefinition;
      spread?: number;
    }
  | {
      type: "random-walk";
      neighbourMode?: "cardinal" | "all";
      allowRevisit?: boolean;
    }
  | {
      type: "follow-terrain";
      terrains: TerrainType[];
      neighbourMode?: "cardinal" | "all";
    }
  | { type: "follow-network"; routeType?: TravelRouteType };

export interface PropagationTraversalDefinition {
  terrainCosts?: Partial<Record<TerrainType, number>>;
  tagCosts?: Record<string, number>;
  roadCostMultiplier?: number;
  settlementCostMultiplier?: number;
  preferMatchingTerrain?: boolean;
  matchingTerrainMultiplier?: number;
}

export type ResistanceDefinition =
  | { type: "terrain"; terrain: TerrainType; resistance: number }
  | { type: "tag"; tag: string; resistance: number }
  | {
      type: "settlement-tier";
      tier: SettlementTier | "village" | "ruin";
      resistance: number;
    }
  | { type: "route"; routeType?: TravelRouteType; resistance: number }
  | {
      type: "property";
      property: string;
      minimum?: number;
      maximum?: number;
      resistance: number;
    };

export type PropagationStopDefinition =
  | { type: "terrain"; terrains: TerrainType[] }
  | { type: "tag"; tags: string[] }
  | { type: "route"; routeType?: TravelRouteType }
  | {
      type: "settlement-tier";
      tiers: Array<SettlementTier | "village" | "ruin">;
    }
  | {
      type: "maximum-distance";
      distance: NumberDefinition;
      metric?: "manhattan" | "chebyshev";
    }
  | { type: "maximum-cost"; cost: number }
  | { type: "map-boundary" }
  | { type: "after-count"; count: NumberDefinition };

export type ReplacementPolicyDefinition =
  | { type: "allow-all" }
  | { type: "only"; terrains: TerrainType[] }
  | { type: "exclude"; terrains: TerrainType[] }
  | {
      type: "priority";
      incomingPriority: number;
      terrainPriorities: Partial<Record<TerrainType, number>>;
      allowEqual?: boolean;
    }
  | {
      type: "matrix";
      rules: ReplacementRule[];
      default: "allow" | "deny";
    };

export interface ReplacementRule {
  from: TerrainType;
  to: TerrainType;
  allowed: boolean;
}

export type BoundaryBehaviourDefinition =
  | { type: "stop" }
  | { type: "discard-overflow" }
  | {
      type: "create-blank-tiles";
      terrain?: TerrainType;
      maximumNewTiles?: NumberDefinition;
    }
  | {
      type: "create-operation-terrain";
      maximumNewTiles?: NumberDefinition;
    }
  | {
      type: "redirect";
      direction: "clockwise" | "counter-clockwise" | "lowest-cost";
    };

export interface PropagatingEffectDefinition {
  type: "propagate";
  operation: PropagationOperationDefinition;
  strategy: PropagationStrategyDefinition;
  magnitude: NumberDefinition;
  includeSeeds?: boolean;
  traversal?: PropagationTraversalDefinition;
  resistance?: ResistanceDefinition[];
  stoppingConditions?: PropagationStopDefinition[];
  replacement?: ReplacementPolicyDefinition;
  boundary?: BoundaryBehaviourDefinition;
}

export interface PropagationContext {
  world: WorldState;
  card: CardDefinition;
  seedTileIds: string[];
  randomSeed: string;
  resolvedTargetValues: Record<string, unknown>;
  previousAction?: WorldAction;
  effectIndex?: number;
}

export interface PropagationStep {
  sequence: number;
  fromTileId?: string;
  toCoordinate: Coordinate;
  tileId?: string;
  createdTile: boolean;
  traversalCost: number;
  accumulatedCost: number;
  applied: boolean;
  skippedReason?: string;
}

export interface PropagationResult {
  valid: boolean;
  seedTileIds: string[];
  affectedTileIds: string[];
  createdTileIds: string[];
  traversedTileIds: string[];
  blockedTileIds: string[];
  steps: PropagationStep[];
  tileChanges: TileChange[];
  validationMessages: string[];
  resolvedValues: Record<string, unknown>;
}

export interface PropagationRecord {
  effectIndex: number;
  seedTileIds: string[];
  affectedTileIds: string[];
  createdTileIds: string[];
  blockedTileIds: string[];
  steps: PropagationStep[];
  resolvedValues: Record<string, unknown>;
}

export type FrontierCandidate = {
  coordinate: Coordinate;
  tileId?: string;
  fromTileId: string;
  traversalCost: number;
  accumulatedCost: number;
  distanceFromSeed: number;
  createdTile: boolean;
};
