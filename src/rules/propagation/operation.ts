import type { MapTile } from "../../world/worldTypes";
import { cloneTile } from "../../world/tileUtils";
import type { PropagationOperationDefinition } from "./types";

export function applyPropagationOperation(
  tile: MapTile,
  operation: PropagationOperationDefinition,
  turn = 0,
): MapTile {
  const updated = cloneTile(tile);

  switch (operation.type) {
    case "set-terrain":
      updated.terrain = operation.terrain;

      if (operation.terrain === "water") {
        delete updated.settlement;
      }

      return updated;

    case "add-tag":
      if (!updated.tags.includes(operation.tag)) {
        updated.tags = [...updated.tags, operation.tag];
      }

      return updated;

    case "remove-tag":
      updated.tags = updated.tags.filter((tag) => tag !== operation.tag);
      return updated;

    case "remove-settlement":
      if (operation.leaveRuin && updated.settlement?.type === "village") {
        updated.settlement = {
          type: "ruin",
          formerType: "village",
          ruinedAtTurn: turn,
        };
        if (!updated.tags.includes("ruined")) {
          updated.tags = [...updated.tags, "ruined"];
        }
      } else {
        delete updated.settlement;
      }

      return updated;

    case "add-overlay":
      throw new Error("Overlay propagation is not supported yet.");

    default: {
      const unreachable: never = operation;
      throw new Error(`Unsupported propagation operation: ${String(unreachable)}`);
    }
  }
}

export function operationChangesTile(
  before: MapTile,
  after: MapTile,
): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}
