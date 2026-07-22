import L from "leaflet";
import type { MapTile } from "../world/worldTypes";
import {
  TARGET_HIGHLIGHT_STYLES,
  type TargetHighlightRole,
} from "./targetHighlightStyles";
import { TILE_SIZE } from "./mapConfig";

export type TargetingHighlightState = {
  showPipeline: boolean;
  origin: ReadonlySet<string>;
  candidates: ReadonlySet<string>;
  filteredOut: ReadonlySet<string>;
  selected: ReadonlySet<string>;
  expanded: ReadonlySet<string>;
};

export type TileHighlightState = {
  selected: ReadonlySet<string>;
  preview: ReadonlySet<string>;
  consequencePreview: ReadonlySet<string>;
  routeOrigin: ReadonlySet<string>;
  routeDestination: ReadonlySet<string>;
  targeting?: TargetingHighlightState;
};

type ResolvedHighlight = {
  borderColor: string;
  borderWeight: number;
  fillOpacity: number;
};

function styleForRole(role: TargetHighlightRole): ResolvedHighlight {
  const style = TARGET_HIGHLIGHT_STYLES[role];

  return {
    borderColor: style.borderColor,
    borderWeight: style.borderWeight,
    fillOpacity: "fillOpacity" in style ? style.fillOpacity : 1,
  };
}

function resolveTileHighlight(
  tileId: string,
  highlights: TileHighlightState,
): ResolvedHighlight {
  const targeting = highlights.targeting;

  if (targeting) {
    if (highlights.routeDestination.has(tileId)) {
      return styleForRole("secondarySelection");
    }

    if (highlights.routeOrigin.has(tileId)) {
      return styleForRole("primarySelection");
    }

    if (targeting.showPipeline && targeting.filteredOut.has(tileId)) {
      return styleForRole("filteredOut");
    }

    if (targeting.expanded.has(tileId)) {
      return styleForRole("expanded");
    }

    if (targeting.selected.has(tileId)) {
      return styleForRole("selected");
    }

    if (targeting.showPipeline && targeting.candidates.has(tileId)) {
      return styleForRole("candidate");
    }

    if (targeting.origin.has(tileId)) {
      return styleForRole("origin");
    }
  }

  let borderColor = "#555";
  let borderWeight = 1;
  let fillOpacity = 1;

  if (highlights.consequencePreview.has(tileId) && !highlights.preview.has(tileId)) {
    borderColor = "#7c3aed";
    borderWeight = 2;
    fillOpacity = 0.9;
  }

  if (highlights.preview.has(tileId)) {
    borderColor = TARGET_HIGHLIGHT_STYLES.expanded.borderColor;
    borderWeight = TARGET_HIGHLIGHT_STYLES.expanded.borderWeight;
    fillOpacity = TARGET_HIGHLIGHT_STYLES.expanded.fillOpacity;
  }

  if (highlights.routeDestination.has(tileId)) {
    borderColor = TARGET_HIGHLIGHT_STYLES.destination.borderColor;
    borderWeight = TARGET_HIGHLIGHT_STYLES.destination.borderWeight;
  }

  if (highlights.routeOrigin.has(tileId)) {
    borderColor = TARGET_HIGHLIGHT_STYLES.origin.borderColor;
    borderWeight = TARGET_HIGHLIGHT_STYLES.origin.borderWeight;
  }

  if (highlights.selected.has(tileId)) {
    borderColor = TARGET_HIGHLIGHT_STYLES.selected.borderColor;
    borderWeight = TARGET_HIGHLIGHT_STYLES.selected.borderWeight;
  }

  return { borderColor, borderWeight, fillOpacity };
}

export function getTerrainColour(terrain: MapTile["terrain"]): string {
  switch (terrain) {
    case "water":
      return "#668fa3";
    case "grassland":
      return "#9cab75";
    case "forest":
      return "#55735a";
    case "mountain":
      return "#827b72";
    case "urban":
      return "#a59181";
    case "chasm":
      return "#2f2a24";
    case "desert":
      return "#c4a574";
    default:
      return "#d8d0b8";
  }
}

export function createTileLayer(
  tile: MapTile,
  highlights: TileHighlightState,
  onSelect: (tileId: string) => void,
): L.Rectangle {
  const bounds = L.latLngBounds(
    [tile.y * TILE_SIZE, tile.x * TILE_SIZE],
    [(tile.y + 1) * TILE_SIZE, (tile.x + 1) * TILE_SIZE],
  );

  const { borderColor, borderWeight, fillOpacity } = resolveTileHighlight(
    tile.id,
    highlights,
  );

  const layer = L.rectangle(bounds, {
    color: borderColor,
    weight: borderWeight,
    fillColor: getTerrainColour(tile.terrain),
    fillOpacity,
  });

  if (tile.settlement) {
    layer.bindTooltip(tile.settlement.type, {
      permanent: true,
      direction: "center",
      className: "tile-settlement-label",
    });
  }

  layer.on("click", (event) => {
    L.DomEvent.stopPropagation(event);
    onSelect(tile.id);
  });

  return layer;
}
