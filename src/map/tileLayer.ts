import L from "leaflet";
import type { MapTile } from "../world/worldTypes";
import { TILE_SIZE } from "./mapConfig";

export type TileHighlightState = {
  selected: ReadonlySet<string>;
  preview: ReadonlySet<string>;
  consequencePreview: ReadonlySet<string>;
  routeOrigin: ReadonlySet<string>;
  routeDestination: ReadonlySet<string>;
};

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

  const isSelected = highlights.selected.has(tile.id);
  const isPreview = highlights.preview.has(tile.id);
  const isConsequencePreview = highlights.consequencePreview.has(tile.id);
  const isRouteOrigin = highlights.routeOrigin.has(tile.id);
  const isRouteDestination = highlights.routeDestination.has(tile.id);

  let borderColor = "#555";
  let borderWeight = 1;
  let fillOpacity = 1;

  if (isConsequencePreview && !isPreview) {
    borderColor = "#7c3aed";
    borderWeight = 2;
    fillOpacity = 0.9;
  }

  if (isPreview) {
    borderColor = "#2563eb";
    borderWeight = 3;
    fillOpacity = 0.85;
  }

  if (isRouteDestination) {
    borderColor = "#15803d";
    borderWeight = 3;
  }

  if (isRouteOrigin) {
    borderColor = "#b45309";
    borderWeight = 3;
  }

  if (isSelected) {
    borderColor = "#c2410c";
    borderWeight = 3;
  }

  const layer = L.rectangle(bounds, {
    color: borderColor,
    weight: borderWeight,
    fillColor: getTerrainColour(tile.terrain),
    fillOpacity: fillOpacity,
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
