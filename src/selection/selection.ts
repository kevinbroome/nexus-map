import { getTileId, parseTileId } from "../world/coordinates";
import type { WorldState } from "../world/worldTypes";
import {
  createEmptySelection,
  getRouteEndpointTileIds,
  type SelectionMode,
  type SelectionState,
} from "./selectionTypes";

function areTilesAdjacent(firstId: string, secondId: string): boolean {
  const first = parseTileId(firstId);
  const second = parseTileId(secondId);

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
      const tileId = getTileId(x, y);

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
        routeOriginTileId: null,
        routeDestinationTileId: null,
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

    case "two-endpoints": {
      if (!current.routeOriginTileId) {
        return {
          ...current,
          routeOriginTileId: tileId,
          routeDestinationTileId: null,
          tileIds: [tileId],
        };
      }

      if (!current.routeDestinationTileId) {
        if (current.routeOriginTileId === tileId) {
          return current;
        }

        return {
          ...current,
          routeDestinationTileId: tileId,
          tileIds: [current.routeOriginTileId, tileId],
        };
      }

      if (tileId === current.routeOriginTileId) {
        return {
          ...current,
          routeOriginTileId: tileId,
          routeDestinationTileId: null,
          tileIds: [tileId],
        };
      }

      return {
        ...current,
        routeDestinationTileId: tileId,
        tileIds: [current.routeOriginTileId, tileId],
      };
    }

    default:
      return current;
  }
}

export function getPrimarySelectedTileId(
  selection: SelectionState,
): string | null {
  if (selection.mode === "two-endpoints") {
    return selection.routeOriginTileId;
  }

  return selection.tileIds[0] ?? null;
}

export function getSecondarySelectedTileId(
  selection: SelectionState,
): string | null {
  if (selection.mode === "two-endpoints") {
    return selection.routeDestinationTileId;
  }

  return selection.tileIds[1] ?? null;
}

export function formatSelection(
  world: WorldState,
  selection: SelectionState,
): string {
  if (selection.mode === "two-endpoints") {
    if (!selection.routeOriginTileId) {
      return "Select a route origin.";
    }

    if (!selection.routeDestinationTileId) {
      const origin = world.tiles[selection.routeOriginTileId];
      return origin
        ? `Origin: ${origin.x}, ${origin.y}. Select a destination.`
        : "Select a route destination.";
    }

    const origin = world.tiles[selection.routeOriginTileId];
    const destination = world.tiles[selection.routeDestinationTileId];

    if (!origin || !destination) {
      return "Route endpoints selected.";
    }

    return `Route: ${origin.x},${origin.y} → ${destination.x},${destination.y}`;
  }

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
    case "two-endpoints":
      return "Route endpoints";
  }
}

export { getRouteEndpointTileIds };
