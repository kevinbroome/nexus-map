import L from "leaflet";
import { getWorldBoundsOrDefault } from "../world/bounds";
import { getExistingTiles } from "../world/coordinates";
import type { TravelRoute } from "../networks/networkTypes";
import type { WorldState } from "../world/worldTypes";
import { TILE_SIZE } from "./mapConfig";
import { getRenderableTileIds, worldBoundsToLeafletBounds } from "./mapBounds";
import {
  renderCommittedRoutes,
  renderRoutePreview,
} from "./routeLayer";
import { createTileLayer, type TileHighlightState } from "./tileLayer";

export type WorldMapView = {
  map: L.Map;
  tileLayerGroup: L.LayerGroup;
  routeLayerGroup: L.LayerGroup;
  previewRouteLayerGroup: L.LayerGroup;
};

function getLeafletWorldBounds(world: WorldState): L.LatLngBounds {
  const bounds = getWorldBoundsOrDefault(world);
  const [southWest, northEast] = worldBoundsToLeafletBounds(bounds);
  return L.latLngBounds(southWest, northEast);
}

/** Updates pan limits when the world grows; does not change zoom or center. */
export function updateMapBounds(map: L.Map, world: WorldState): void {
  map.setMaxBounds(getLeafletWorldBounds(world).pad(0.25));
}

/** Initial framing only — use when the map is first created or a new world is loaded. */
export function fitMapToWorld(map: L.Map, world: WorldState): void {
  const leafletBounds = getLeafletWorldBounds(world);
  updateMapBounds(map, world);
  map.fitBounds(leafletBounds, { animate: false });
}

export function createWorldMap(
  containerId: string,
  world: WorldState,
  highlights: TileHighlightState,
  onSelect: (tileId: string) => void,
  onSelectRoute?: (routeId: string) => void,
): WorldMapView {
  const map = L.map(containerId, {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 3,
    zoomControl: true,
  });

  fitMapToWorld(map, world);

  const tileLayerGroup = L.layerGroup().addTo(map);
  const routeLayerGroup = L.layerGroup().addTo(map);
  const previewRouteLayerGroup = L.layerGroup().addTo(map);

  renderWorldMap(
    { map, tileLayerGroup, routeLayerGroup, previewRouteLayerGroup },
    world,
    highlights,
    onSelect,
    onSelectRoute,
  );

  return { map, tileLayerGroup, routeLayerGroup, previewRouteLayerGroup };
}

export function renderWorldMap(
  view: WorldMapView,
  world: WorldState,
  highlights: TileHighlightState,
  onSelect: (tileId: string) => void,
  onSelectRoute?: (routeId: string) => void,
  previewRoute?: TravelRoute | null,
): void {
  renderWorldTiles(view.tileLayerGroup, world, highlights, onSelect);
  renderWorldRoutes(view.routeLayerGroup, world, onSelectRoute);
  renderPreviewRoute(view.previewRouteLayerGroup, world, previewRoute ?? null);
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

export function renderWorldRoutes(
  routeLayerGroup: L.LayerGroup,
  world: WorldState,
  onSelectRoute?: (routeId: string) => void,
): void {
  routeLayerGroup.clearLayers();
  renderCommittedRoutes(
    routeLayerGroup,
    world.travelRoutes,
    world.tiles,
    onSelectRoute,
  );
}

export function renderPreviewRoute(
  previewRouteLayerGroup: L.LayerGroup,
  world: WorldState,
  previewRoute: TravelRoute | null,
): void {
  previewRouteLayerGroup.clearLayers();

  if (previewRoute) {
    renderRoutePreview(previewRouteLayerGroup, previewRoute, world.tiles);
  }
}

export function getRenderedTileCount(world: WorldState): number {
  return getExistingTiles(world).length;
}

export { TILE_SIZE };
