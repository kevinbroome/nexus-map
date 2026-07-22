import type { CardDefinition } from "./cardTypes";
import type { WorldState } from "../world/worldTypes";

export type CardValidation = {
  valid: boolean;
  message: string;
};

export function validateCardApplication(
  world: WorldState,
  card: CardDefinition,
  selectedTileIds: string[],
): CardValidation {
  if (selectedTileIds.length === 0) {
    return { valid: false, message: "Select a tile first." };
  }

  if (selectedTileIds.length > 1) {
    return {
      valid: false,
      message: "Cards currently require exactly one selected tile.",
    };
  }

  const tileId = selectedTileIds[0]!;
  const tile = world.tiles[tileId];

  if (!tile) {
    return { valid: false, message: "Selected tile does not exist." };
  }

  switch (card.action.type) {
    case "add-settlement":
      if (tile.terrain === "water") {
        return {
          valid: false,
          message: "A settlement cannot be created on water.",
        };
      }

      if (tile.settlement) {
        return {
          valid: false,
          message: "This tile already has a settlement.",
        };
      }

      break;

    case "set-terrain":
      break;

    default: {
      const unreachable: never = card.action;
      return {
        valid: false,
        message: `Unsupported action: ${String(unreachable)}`,
      };
    }
  }

  return { valid: true, message: "Ready to apply." };
}
