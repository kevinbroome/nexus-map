import L from "leaflet";
import { getWorldBoundsOrDefault } from "../world/bounds";
import { getExistingTiles } from "../world/coordinates";
import type { TravelRoute } from "../networks/networkTypes";
import type { WorldState } from "../world/worldTypes";
import { TILE_SIZE } from "./mapConfig";
import { worldBoundsToLeafletBounds } from "./mapBounds";
import type { TileHighlightState } from "./tileLayer";
import { getDevVisualControls } from "../visuals/devVisualControls";
import { initializeMapTheme } from "../visuals/themeManager";
import {
  clearMapLayerGroups,
  createMapLayerGroups,
  type MapLayerGroups,
} from "../visuals/renderers/mapLayerGroups";
import {
  getDetailLevelForMap,
  renderVisualMap,
} from "../visuals/renderers/mapVisualRenderer";

export type WorldMapView = {
  map: L.Map;
  layers: MapLayerGroups;
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
  selectedTileIds: string[] = [],
): WorldMapView {
  initializeMapTheme();

  const map = L.map(containerId, {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 3,
    zoomControl: true,
  });

  fitMapToWorld(map, world);

  const layers = createMapLayerGroups(map);

  renderWorldMap(
    { map, layers },
    world,
    highlights,
    onSelect,
    onSelectRoute,
    null,
    selectedTileIds,
  );

  return { map, layers };
}

export function renderWorldMap(
  view: WorldMapView,
  world: WorldState,
  highlights: TileHighlightState,
  onSelect: (tileId: string) => void,
  onSelectRoute?: (routeId: string) => void,
  previewRoute?: TravelRoute | null,
  selectedTileIds: string[] = [],
): void {
  clearMapLayerGroups(view.layers);

  renderVisualMap(view.map, view.layers, world, {
    theme: initializeMapTheme(),
    highlights,
    detailLevel: getDetailLevelForMap(view.map),
    devControls: import.meta.env.DEV ? getDevVisualControls() : undefined,
    previewRoute: previewRoute ?? null,
    selectedTileIds,
    onSelectTile: onSelect,
    onSelectRoute,
    isDevMode: import.meta.env.DEV,
  });
}

export function getRenderedTileCount(world: WorldState): number {
  return getExistingTiles(world).length;
}

export { TILE_SIZE };
