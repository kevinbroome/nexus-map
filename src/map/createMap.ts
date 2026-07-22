import L from "leaflet";
import { getWorldBoundsOrDefault } from "../world/bounds";
import { getExistingTiles } from "../world/coordinates";
import type { WorldState } from "../world/worldTypes";
import { TILE_SIZE } from "./mapConfig";
import { getRenderableTileIds, worldBoundsToLeafletBounds } from "./mapBounds";
import { createTileLayer, type TileHighlightState } from "./tileLayer";

export type WorldMapView = {
  map: L.Map;
  tileLayerGroup: L.LayerGroup;
};

export function syncMapViewport(map: L.Map, world: WorldState): void {
  const bounds = getWorldBoundsOrDefault(world);
  const [southWest, northEast] = worldBoundsToLeafletBounds(bounds);
  const leafletBounds = L.latLngBounds(southWest, northEast);

  map.setMaxBounds(leafletBounds.pad(0.25));
  map.fitBounds(leafletBounds, { animate: false });
}

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

  syncMapViewport(map, world);

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

  for (const tileId of getRenderableTileIds(world)) {
    const tile = world.tiles[tileId];

    if (!tile) {
      continue;
    }

    createTileLayer(tile, highlights, onSelect).addTo(tileLayerGroup);
  }
}

export function getRenderedTileCount(world: WorldState): number {
  return getExistingTiles(world).length;
}

export { TILE_SIZE };
