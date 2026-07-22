import L from "leaflet";
import type { TravelRoute } from "../networks/networkTypes";
import { ROUTE_STYLES } from "../networks/networkTypes";
import { TILE_SIZE } from "./mapConfig";

function tileCenterLatLng(tileId: string, worldTiles: Record<string, { x: number; y: number }>): L.LatLng | null {
  const tile = worldTiles[tileId];

  if (!tile) {
    return null;
  }

  return L.latLng(
    (tile.y + 0.5) * TILE_SIZE,
    (tile.x + 0.5) * TILE_SIZE,
  );
}

export function pathTileIdsToLatLngs(
  pathTileIds: string[],
  worldTiles: Record<string, { x: number; y: number }>,
): L.LatLng[] {
  const points: L.LatLng[] = [];

  for (const tileId of pathTileIds) {
    const center = tileCenterLatLng(tileId, worldTiles);

    if (center) {
      points.push(center);
    }
  }

  return points;
}

export function createRoutePolyline(
  route: TravelRoute,
  worldTiles: Record<string, { x: number; y: number }>,
  options: { preview?: boolean; onSelect?: (routeId: string) => void } = {},
): L.Polyline {
  const style = ROUTE_STYLES[route.type];
  const points = pathTileIdsToLatLngs(route.pathTileIds, worldTiles);

  const polyline = L.polyline(points, {
    color: options.preview ? style.previewColor : style.committedColor,
    weight: options.preview ? style.previewWeight : style.committedWeight,
    opacity: options.preview ? style.previewOpacity : style.committedOpacity,
    dashArray: options.preview ? style.previewDashArray : undefined,
  });

  polyline.bindTooltip(`${route.type} (${route.pathTileIds.length} tiles)`, {
    sticky: true,
  });

  if (options.onSelect) {
    polyline.on("click", (event) => {
      L.DomEvent.stopPropagation(event);
      options.onSelect?.(route.id);
    });
  }

  return polyline;
}

export function renderCommittedRoutes(
  layerGroup: L.LayerGroup,
  routes: Record<string, TravelRoute>,
  worldTiles: Record<string, { x: number; y: number }>,
  onSelectRoute?: (routeId: string) => void,
): void {
  const sortedRoutes = Object.values(routes).sort((left, right) =>
    left.id.localeCompare(right.id),
  );

  for (const route of sortedRoutes) {
    createRoutePolyline(route, worldTiles, { onSelect: onSelectRoute }).addTo(
      layerGroup,
    );
  }
}

export function renderRoutePreview(
  layerGroup: L.LayerGroup,
  route: TravelRoute,
  worldTiles: Record<string, { x: number; y: number }>,
): void {
  createRoutePolyline(route, worldTiles, { preview: true }).addTo(layerGroup);
}
