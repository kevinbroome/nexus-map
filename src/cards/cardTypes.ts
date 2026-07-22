import type {
  ProposedTravelRoute,
  RouteChange,
  TravelNodeType,
} from "../networks/networkTypes";
import type {
  SettlementRegionChange,
  TerrainType,
  TileChange,
  WorldConsequence,
  WorldState,
} from "../world/worldTypes";

export type TargetDefinition =
  | { type: "single-tile" }
  | { type: "adjacent-tiles"; radius: number }
  | { type: "connected-region"; terrain?: TerrainType }
  | { type: "rectangle"; maxWidth: number; maxHeight: number }
  | { type: "settlement" }
  | { type: "global" }
  | { type: "two-endpoints"; allowedNodeTypes: TravelNodeType[] };

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
  | {
      type: "create-travel-route";
      routeType: import("../networks/networkTypes").TravelRouteType;
      destination:
        | { type: "selected-secondary-target" }
        | { type: "nearest-valid-settlement" }
        | { type: "random-valid-settlement" };
      preferExistingNetwork?: boolean;
    };

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
    nextTurn: 0,
    resultingWorld: null,
    randomSeed,
    resolvedValues: {},
  };
}

export function cardRequiresTwoEndpoints(card: CardDefinition): boolean {
  return card.target.type === "two-endpoints";
}
