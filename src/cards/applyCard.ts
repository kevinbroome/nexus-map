import type { CardDefinition } from "./cardTypes";
import type { MapTile, TileChange } from "../world/worldTypes";

function cloneTile(tile: MapTile): MapTile {
  return structuredClone(tile);
}

function computeUpdatedTile(tile: MapTile, card: CardDefinition): MapTile {
  const updatedTile = cloneTile(tile);

  switch (card.action.type) {
    case "set-terrain":
      updatedTile.terrain = card.action.terrain;

      if (card.action.terrain === "water") {
        delete updatedTile.settlement;
      }

      break;

    case "add-settlement":
      if (tile.terrain === "water") {
        throw new Error("A settlement cannot be created on water.");
      }

      updatedTile.settlement = {
        type: card.action.settlementType,
      };

      break;

    default: {
      const unreachable: never = card.action;
      throw new Error(`Unsupported action: ${String(unreachable)}`);
    }
  }

  return updatedTile;
}

export function proposeCardChanges(
  world: { tiles: Record<string, MapTile> },
  card: CardDefinition,
  targetIds: string[],
): TileChange[] {
  return targetIds.map((tileId) => {
    const before = world.tiles[tileId];

    if (!before) {
      throw new Error(`Tile "${tileId}" does not exist.`);
    }

    return {
      tileId,
      before: cloneTile(before),
      after: computeUpdatedTile(before, card),
    };
  });
}

export function applyCardToTile(
  world: { tiles: Record<string, MapTile>; updatedAt?: string },
  card: CardDefinition,
  tileId: string,
): { tiles: Record<string, MapTile>; updatedAt: string } {
  const [change] = proposeCardChanges(world, card, [tileId]);

  return {
    updatedAt: new Date().toISOString(),
    tiles: {
      ...world.tiles,
      [tileId]: cloneTile(change.after),
    },
  };
}
