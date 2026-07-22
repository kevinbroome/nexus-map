import L from "leaflet";
import type { WorldState } from "../world/worldTypes";
import {
  GRID_HEIGHT,
  GRID_WIDTH,
  TILE_SIZE,
  WORLD_PIXEL_HEIGHT,
  WORLD_PIXEL_WIDTH,
} from "./mapConfig";
import { createTileLayer, type TileHighlightState } from "./tileLayer";

export type WorldMapView = {
  map: L.Map;
  tileLayerGroup: L.LayerGroup;
};

export function createWorldMap(
  containerId: string,
  world: WorldState,
  highlights: TileHighlightState,
  onSelect: (tileId: string) => void,
): WorldMapView {
  const map = L.map(containerId, {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 3,
    zoomControl: true,
  });

  const bounds = L.latLngBounds(
    [0, 0],
    [world.height * TILE_SIZE, world.width * TILE_SIZE],
  );

  map.setMaxBounds(bounds.pad(0.25));
  map.fitBounds(bounds);

  const tileLayerGroup = L.layerGroup().addTo(map);

  renderWorldTiles(tileLayerGroup, world, highlights, onSelect);

  return { map, tileLayerGroup };
}

export function renderWorldTiles(
  tileLayerGroup: L.LayerGroup,
  world: WorldState,
  highlights: TileHighlightState,
  onSelect: (tileId: string) => void,
): void {
  tileLayerGroup.clearLayers();

  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const tile = world.tiles[`${x},${y}`];

      if (!tile) {
        continue;
      }

      createTileLayer(tile, highlights, onSelect).addTo(tileLayerGroup);
    }
  }
}

export function getDefaultWorldDimensions(): {
  width: number;
  height: number;
} {
  return {
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
  };
}

export function getDefaultWorldPixelSize(): {
  width: number;
  height: number;
} {
  return {
    width: WORLD_PIXEL_WIDTH,
    height: WORLD_PIXEL_HEIGHT,
  };
}
