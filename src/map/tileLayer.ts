import L from "leaflet";
import type { MapTile } from "../world/worldTypes";
import { TILE_SIZE } from "./mapConfig";

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
    default:
      return "#d8d0b8";
  }
}

export function createTileLayer(
  tile: MapTile,
  selectedTileIds: ReadonlySet<string>,
  onSelect: (tileId: string) => void,
): L.Rectangle {
  const bounds = L.latLngBounds(
    [tile.y * TILE_SIZE, tile.x * TILE_SIZE],
    [(tile.y + 1) * TILE_SIZE, (tile.x + 1) * TILE_SIZE],
  );

  const isSelected = selectedTileIds.has(tile.id);

  const layer = L.rectangle(bounds, {
    color: isSelected ? "#c2410c" : "#555",
    weight: isSelected ? 3 : 1,
    fillColor: getTerrainColour(tile.terrain),
    fillOpacity: 1,
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
