import type { TerrainType } from "../world/worldTypes";

export type CardAction =
  | {
      type: "set-terrain";
      terrain: TerrainType;
    }
  | {
      type: "add-settlement";
      settlementType: "village" | "town" | "city";
    };

export interface CardDefinition {
  id: string;
  name: string;
  description: string;
  targetType: "tile";
  action: CardAction;
}
