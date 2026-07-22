export type SelectionMode =
  | "single"
  | "adjacent"
  | "rectangle"
  | "two-endpoints";

export type SelectionState = {
  mode: SelectionMode;
  tileIds: string[];
  rectangleAnchorId: string | null;
  routeOriginTileId: string | null;
  routeDestinationTileId: string | null;
};

export function createEmptySelection(mode: SelectionMode): SelectionState {
  return {
    mode,
    tileIds: [],
    rectangleAnchorId: null,
    routeOriginTileId: null,
    routeDestinationTileId: null,
  };
}

export function getRouteEndpointTileIds(selection: SelectionState): string[] {
  const ids: string[] = [];

  if (selection.routeOriginTileId) {
    ids.push(selection.routeOriginTileId);
  }

  if (selection.routeDestinationTileId) {
    ids.push(selection.routeDestinationTileId);
  }

  return ids;
}
