import type { TerrainType } from "../world/worldTypes";

export type TargetDefinition =
  | { type: "single-tile" }
  | { type: "adjacent-tiles"; radius: number }
  | { type: "connected-region"; terrain?: TerrainType }
  | { type: "rectangle"; maxWidth: number; maxHeight: number }
  | { type: "settlement" }
  | { type: "global" };

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
  | { type: "add-tag"; tag: string };

export interface CardDefinition {
  id: string;
  name: string;
  description: string;
  target: TargetDefinition;
  conditions: ConditionDefinition[];
  effects: EffectDefinition[];
}

import type { TileChange } from "../world/worldTypes";

export interface ProposedAction {
  cardId: string;
  targetIds: string[];
  valid: boolean;
  validationMessages: string[];
  changes: TileChange[];
  randomSeed: string;
  resolvedValues: Record<string, unknown>;
}
