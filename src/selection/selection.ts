import { createTileId } from "../world/worldState";
import type { WorldState } from "../world/worldTypes";
import {
  createEmptySelection,
  type SelectionMode,
  type SelectionState,
} from "./selectionTypes";

function parseTileCoordinates(tileId: string): { x: number; y: number } {
  const [xValue, yValue] = tileId.split(",");
  const x = Number(xValue);
  const y = Number(yValue);

  if (Number.isNaN(x) || Number.isNaN(y)) {
    throw new Error(`Invalid tile id: "${tileId}".`);
  }

  return { x, y };
}

function areTilesAdjacent(firstId: string, secondId: string): boolean {
  const first = parseTileCoordinates(firstId);
  const second = parseTileCoordinates(secondId);

  return (
    Math.abs(first.x - second.x) + Math.abs(first.y - second.y) === 1
  );
}

function isAdjacentToAny(tileId: string, selectedTileIds: string[]): boolean {
  return selectedTileIds.some((selectedId) =>
    areTilesAdjacent(tileId, selectedId),
  );
}

function getTilesInRectangle(
  world: WorldState,
  anchorId: string,
  cornerId: string,
): string[] {
  const anchor = world.tiles[anchorId];
  const corner = world.tiles[cornerId];

  if (!anchor || !corner) {
    return [];
  }

  const minX = Math.min(anchor.x, corner.x);
  const maxX = Math.max(anchor.x, corner.x);
  const minY = Math.min(anchor.y, corner.y);
  const maxY = Math.max(anchor.y, corner.y);
  const tileIds: string[] = [];

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const tileId = createTileId(x, y);

      if (world.tiles[tileId]) {
        tileIds.push(tileId);
      }
    }
  }

  return tileIds;
}

export function setSelectionMode(
  _current: SelectionState,
  mode: SelectionMode,
): SelectionState {
  return createEmptySelection(mode);
}

export function handleTileSelection(
  world: WorldState,
  current: SelectionState,
  tileId: string,
): SelectionState {
  if (!world.tiles[tileId]) {
    return current;
  }

  switch (current.mode) {
    case "single":
      return {
        ...current,
        tileIds: [tileId],
        rectangleAnchorId: null,
      };

    case "adjacent": {
      if (current.tileIds.length === 0) {
        return {
          ...current,
          tileIds: [tileId],
          rectangleAnchorId: null,
        };
      }

      if (current.tileIds.includes(tileId)) {
        if (current.tileIds.length === 1) {
          return current;
        }

        return {
          ...current,
          tileIds: current.tileIds.filter((id) => id !== tileId),
        };
      }

      if (isAdjacentToAny(tileId, current.tileIds)) {
        return {
          ...current,
          tileIds: [...current.tileIds, tileId],
        };
      }

      return {
        ...current,
        tileIds: [tileId],
      };
    }

    case "rectangle": {
      if (!current.rectangleAnchorId) {
        return {
          ...current,
          tileIds: [tileId],
          rectangleAnchorId: tileId,
        };
      }

      if (current.rectangleAnchorId === tileId) {
        return {
          ...current,
          tileIds: [tileId],
        };
      }

      return {
        ...current,
        tileIds: getTilesInRectangle(
          world,
          current.rectangleAnchorId,
          tileId,
        ),
        rectangleAnchorId: null,
      };
    }

    default:
      return current;
  }
}

export function getPrimarySelectedTileId(
  selection: SelectionState,
): string | null {
  return selection.tileIds[0] ?? null;
}

export function formatSelection(
  world: WorldState,
  selection: SelectionState,
): string {
  if (selection.tileIds.length === 0) {
    if (selection.mode === "rectangle" && selection.rectangleAnchorId) {
      return "Rectangle: choose the opposite corner";
    }

    return "No location selected";
  }

  if (selection.tileIds.length === 1) {
    const tile = world.tiles[selection.tileIds[0]!];

    if (!tile) {
      return "No location selected";
    }

    const settlement = tile.settlement ? `, ${tile.settlement.type}` : "";

    return `Selected: ${tile.x}, ${tile.y} (${tile.terrain}${settlement})`;
  }

  return `Selected: ${selection.tileIds.length} tiles (${selection.mode})`;
}

export function getSelectionModeLabel(mode: SelectionMode): string {
  switch (mode) {
    case "single":
      return "Single tile";
    case "adjacent":
      return "Adjacent tiles";
    case "rectangle":
      return "Rectangle";
  }
}
