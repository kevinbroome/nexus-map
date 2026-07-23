import L from "leaflet";
import { getWorldBoundsOrDefault } from "../../world/bounds";
import { worldBoundsToLeafletBounds } from "../../map/mapBounds";
import { getRenderableTileIds } from "../../map/mapBounds";
import type { TileHighlightState } from "../../map/tileLayer";
import type { TravelRoute } from "../../networks/networkTypes";
import type { WorldState } from "../../world/worldTypes";
import { getVisualWorldSnapshot } from "../cache/visualCache";
import type { DevVisualControls } from "../devVisualControls";
import { detailLevelAtLeast, getDetailLevelFromZoom } from "../detailLevel";
import { getDefaultSmoothingForTerrain, smoothPolygonBoundary } from "../geometry/smoothing";
import {
  findRouteEndpoints,
  findRouteIntersections,
  smoothRoutePath,
} from "../geometry/routeGeometry";
import { buildMapLabels, resolveVisibleLabels } from "../labels/labelModel";
import { getTerrainVisualStyle, type MapDetailLevel, type MapVisualTheme } from "../theme";
import { resolveTileVisualLayers } from "../tags/tagVisualRegistry";
import type { VisualTerrainRegion } from "../geometry/terrainRegions";
import {
  polygonToLatLngs,
  ringToLatLngs,
  tileBoundsToLatLngBounds,
  tileCenterLatLng,
  worldCoordinateToLatLng,
} from "./leafletAdapters";
import type { MapLayerGroups } from "./mapLayerGroups";
import { ensurePatternDefinitions } from "./patternRenderer";

export interface MapVisualRenderOptions {
  theme: MapVisualTheme;
  highlights: TileHighlightState;
  detailLevel: MapDetailLevel;
  devControls?: DevVisualControls;
  previewRoute?: TravelRoute | null;
  selectedTileIds?: string[];
  onSelectTile: (tileId: string) => void;
  onSelectRoute?: (routeId: string) => void;
  isDevMode?: boolean;
}

function resolvePreviewStyle(
  tileId: string,
  highlights: TileHighlightState,
  theme: MapVisualTheme,
): L.PathOptions | null {
  const previews = theme.previews;

  if (highlights.propagation?.blocked.has(tileId)) {
    return {
      color: previews.propagationBlocked.borderColor,
      weight: previews.propagationBlocked.borderWeight,
      fillColor: previews.propagationBlocked.fillColor,
      fillOpacity: previews.propagationBlocked.fillOpacity,
    };
  }

  if (highlights.propagation?.created.has(tileId)) {
    return {
      color: previews.propagationCreated.borderColor,
      weight: previews.propagationCreated.borderWeight,
      fillColor: previews.propagationCreated.fillColor,
      fillOpacity: previews.propagationCreated.fillOpacity,
      dashArray: previews.propagationCreated.dashArray,
    };
  }

  if (highlights.propagation?.affected.has(tileId)) {
    return {
      color: previews.propagationAffected.borderColor,
      weight: previews.propagationAffected.borderWeight,
      fillColor: previews.propagationAffected.fillColor,
      fillOpacity: previews.propagationAffected.fillOpacity,
    };
  }

  if (highlights.propagation?.seed.has(tileId)) {
    return {
      color: previews.propagationSeed.borderColor,
      weight: previews.propagationSeed.borderWeight,
      fillColor: previews.propagationSeed.fillColor,
      fillOpacity: previews.propagationSeed.fillOpacity,
    };
  }

  if (highlights.targeting?.origin.has(tileId)) {
    return {
      color: previews.origin.borderColor,
      weight: previews.origin.borderWeight,
    };
  }

  if (highlights.consequencePreview.has(tileId) && !highlights.preview.has(tileId)) {
    return {
      color: previews.consequence.borderColor,
      weight: previews.consequence.borderWeight,
      fillColor: previews.consequence.fillColor,
      fillOpacity: previews.consequence.fillOpacity,
    };
  }

  if (highlights.preview.has(tileId)) {
    return {
      color: previews.expanded.borderColor,
      weight: previews.expanded.borderWeight,
      fillColor: previews.expanded.fillColor,
      fillOpacity: previews.expanded.fillOpacity,
    };
  }

  if (highlights.selected.has(tileId)) {
    return {
      color: previews.selection.borderColor,
      weight: previews.selection.borderWeight,
    };
  }

  if (highlights.routeOrigin.has(tileId)) {
    return {
      color: previews.primaryTarget.borderColor,
      weight: previews.primaryTarget.borderWeight,
    };
  }

  if (highlights.routeDestination.has(tileId)) {
    return {
      color: previews.secondaryTarget.borderColor,
      weight: previews.secondaryTarget.borderWeight,
    };
  }

  return null;
}

function tileIdToRing(tileId: string) {
  const [xText, yText] = tileId.split(",");
  const x = Number(xText);
  const y = Number(yText);

  return [
    { x, y },
    { x: x + 1, y },
    { x: x + 1, y: y + 1 },
    { x, y: y + 1 },
  ];
}

function renderTerrainTileFallbacks(
  groups: MapLayerGroups,
  region: VisualTerrainRegion,
  theme: MapVisualTheme,
): void {
  const style = getTerrainVisualStyle(region.terrain, theme);

  for (const tileId of region.tileIds) {
    const ring = tileIdToRing(tileId);

    L.polygon(polygonToLatLngs([ring]), {
      stroke: false,
      fillColor: style.baseColor,
      fillOpacity: style.opacity ?? 1,
      interactive: false,
    }).addTo(groups.terrainBaseLayer);

    if (style.patternId) {
      L.polygon(polygonToLatLngs([ring]), {
        stroke: false,
        fillColor: style.baseColor,
        fillOpacity: 0.35,
        className: `nexus-pattern-${style.patternId}`,
        interactive: false,
      }).addTo(groups.terrainTextureLayer);
    }

    if (style.boundary) {
      L.polyline(ringToLatLngs(ring), {
        color: style.boundary.stroke,
        weight: style.boundary.weight,
        dashArray: style.boundary.dashArray,
        interactive: false,
      }).addTo(groups.terrainBoundaryLayer);
    }
  }
}

function renderTerrainRegion(
  groups: MapLayerGroups,
  region: VisualTerrainRegion,
  theme: MapVisualTheme,
  devControls?: DevVisualControls,
): void {
  const style = getTerrainVisualStyle(region.terrain, theme);
  const smoothing = devControls?.disableBoundarySmoothing
    ? { enabled: false, iterations: 0, strength: 0 }
    : getDefaultSmoothingForTerrain(region.terrain);

  const geometry =
    devControls?.showRawTerrainPolygons || !smoothing.enabled
      ? region.boundaryGeometry
      : smoothPolygonBoundary(
          region.boundaryGeometry,
          smoothing,
          theme.performance.maxPointsPerRegion,
        );

  const rings = geometry.rings.map((ring) => ring.points);

  if (rings.length === 0) {
    renderTerrainTileFallbacks(groups, region, theme);
    return;
  }

  const base = L.polygon(polygonToLatLngs(rings), {
    stroke: false,
    fillColor: style.baseColor,
    fillOpacity: style.opacity ?? 1,
    interactive: false,
  });
  base.addTo(groups.terrainBaseLayer);

  if (style.patternId) {
    const textured = L.polygon(polygonToLatLngs(rings), {
      stroke: false,
      fillColor: style.baseColor,
      fillOpacity: 0.35,
      className: `nexus-pattern-${style.patternId}`,
      interactive: false,
    });
    textured.addTo(groups.terrainTextureLayer);
  }

  if (style.coastline && region.terrain === "water") {
    for (const ring of rings) {
      L.polyline(ringToLatLngs(ring), {
        color: style.coastline.outerStroke,
        weight: style.coastline.outerWeight,
        interactive: false,
      }).addTo(groups.terrainBoundaryLayer);

      if (style.coastline.innerStroke) {
        L.polyline(ringToLatLngs(ring), {
          color: style.coastline.innerStroke,
          weight: style.coastline.innerWeight ?? 1,
          interactive: false,
        }).addTo(groups.terrainBoundaryLayer);
      }
    }
    return;
  }

  if (style.boundary) {
    for (const ring of rings) {
      L.polyline(ringToLatLngs(ring), {
        color: style.boundary.stroke,
        weight: style.boundary.weight,
        dashArray: style.boundary.dashArray,
        interactive: false,
      }).addTo(groups.terrainBoundaryLayer);
    }
  }
}

function renderInteractionTiles(
  groups: MapLayerGroups,
  world: WorldState,
  onSelect: (tileId: string) => void,
): void {
  for (const tileId of getRenderableTileIds(world)) {
    const tile = world.tiles[tileId];

    if (!tile) {
      continue;
    }

    const hitTarget = L.rectangle(tileBoundsToLatLngBounds(tile.x, tile.y), {
      stroke: false,
      fillOpacity: 0,
      interactive: true,
    });

    hitTarget.on("click", (event) => {
      L.DomEvent.stopPropagation(event);
      onSelect(tile.id);
    });

    hitTarget.addTo(groups.interactionLayer);
  }
}

function renderGridOverlay(
  groups: MapLayerGroups,
  world: WorldState,
  theme: MapVisualTheme,
): void {
  for (const tileId of getRenderableTileIds(world)) {
    const tile = world.tiles[tileId];

    if (!tile) {
      continue;
    }

    L.rectangle(tileBoundsToLatLngBounds(tile.x, tile.y), {
      color: theme.grid.stroke,
      weight: theme.grid.weight,
      opacity: theme.grid.opacity,
      fillOpacity: 0,
      interactive: false,
    }).addTo(groups.developmentLayer);
  }
}

function renderTileOverlays(
  groups: MapLayerGroups,
  world: WorldState,
  theme: MapVisualTheme,
): void {
  for (const tileId of getRenderableTileIds(world)) {
    const tile = world.tiles[tileId];

    if (!tile) {
      continue;
    }

    for (const visual of resolveTileVisualLayers(tile, theme)) {
      const bounds = tileBoundsToLatLngBounds(tile.x, tile.y);

      if (visual.layer === "border") {
        L.rectangle(bounds, {
          color: visual.borderColor,
          weight: visual.borderWeight ?? 1,
          dashArray: visual.borderDashArray,
          fillOpacity: 0,
          interactive: false,
        }).addTo(groups.overlayLayer);
      }

      if (visual.layer === "tint") {
        L.rectangle(bounds, {
          stroke: false,
          fillColor: visual.tintColor,
          fillOpacity: visual.tintOpacity ?? 0.3,
          interactive: false,
        }).addTo(groups.overlayLayer);
      }

      if (visual.layer === "pattern" && visual.patternId) {
        L.rectangle(bounds, {
          stroke: false,
          fillColor: theme.terrain.empty.baseColor,
          fillOpacity: visual.opacity,
          className: `nexus-pattern-${visual.patternId}`,
          interactive: false,
        }).addTo(groups.overlayLayer);
      }

      if (visual.layer === "symbol" && visual.symbol) {
        const center = tileCenterLatLng(tile.id);

        if (center) {
          L.marker(center, {
            interactive: false,
            icon: L.divIcon({
              className: "nexus-tag-symbol",
              html: `<span>${visual.symbol}</span>`,
              iconSize: [12, 12],
            }),
          }).addTo(groups.overlayLayer);
        }
      }
    }
  }
}

function renderRoutes(
  groups: MapLayerGroups,
  world: WorldState,
  theme: MapVisualTheme,
  options: MapVisualRenderOptions,
): void {
  const snapshot = getVisualWorldSnapshot(world);
  const intersections = findRouteIntersections(snapshot.routeSegments);
  const endpoints = findRouteEndpoints(world.travelRoutes);

  for (const segment of snapshot.routeSegments) {
    const routeType = segment.routeTypes[0] ?? "road";
    const style = theme.roads[routeType];
    const path = options.devControls?.showRouteTilePaths
      ? [segment.fromTileId, segment.toTileId]
      : [segment.fromTileId, segment.toTileId];
    const points = (options.devControls?.showSmoothedRoads ?? true)
      ? smoothRoutePath(path).map((point) => worldCoordinateToLatLng(point))
      : path
          .map((tileId) => tileCenterLatLng(tileId))
          .filter((point): point is L.LatLng => point !== null);

    L.polyline(points, {
      color: style.outerColor,
      weight: style.outerWeight,
      opacity: style.opacity,
      dashArray: style.dashArray,
      interactive: false,
    }).addTo(groups.routeLayer);

    L.polyline(points, {
      color: style.innerColor,
      weight: style.innerWeight,
      opacity: style.opacity,
      dashArray: style.dashArray,
      interactive: false,
    }).addTo(groups.routeLayer);

    if (
      detailLevelAtLeast(options.detailLevel, "regional") &&
      style.markerAtIntersections
    ) {
      for (const tileId of [segment.fromTileId, segment.toTileId]) {
        if (intersections.has(tileId) || endpoints.has(tileId)) {
          const center = tileCenterLatLng(tileId);

          if (center) {
            L.circleMarker(center, {
              radius: 3,
              color: style.outerColor,
              fillColor: style.innerColor,
              fillOpacity: 1,
              weight: 1,
              interactive: false,
            }).addTo(groups.routeLayer);
          }
        }
      }
    }
  }

  for (const route of Object.values(world.travelRoutes)) {
    const style = theme.roads[route.type];
    const points = (options.devControls?.showSmoothedRoads ?? true)
      ? smoothRoutePath(route.pathTileIds).map((point) =>
          worldCoordinateToLatLng(point),
        )
      : route.pathTileIds
          .map((tileId) => tileCenterLatLng(tileId))
          .filter((point): point is L.LatLng => point !== null);

    const hitTarget = L.polyline(points, {
      color: style.outerColor,
      weight: Math.max(style.outerWeight, 8),
      opacity: 0.01,
      interactive: true,
    });

    hitTarget.on("click", (event) => {
      L.DomEvent.stopPropagation(event);
      options.onSelectRoute?.(route.id);
    });

    hitTarget.addTo(groups.routeLayer);
  }
}

function renderPreviewRoute(
  groups: MapLayerGroups,
  previewRoute: TravelRoute | null,
  theme: MapVisualTheme,
): void {
  if (!previewRoute) {
    return;
  }

  const style = theme.roads[previewRoute.type];
  const points = smoothRoutePath(previewRoute.pathTileIds)
    .map((point) => worldCoordinateToLatLng(point));

  L.polyline(points, {
    color: style.outerColor,
    weight: style.outerWeight,
    opacity: 0.55,
    dashArray: style.previewDashArray ?? "8 6",
    interactive: false,
  }).addTo(groups.previewRouteLayer);
}

function renderSettlements(
  groups: MapLayerGroups,
  world: WorldState,
  theme: MapVisualTheme,
  detailLevel: MapDetailLevel,
): void {
  for (const tile of Object.values(world.tiles)) {
    if (!tile.settlement) {
      continue;
    }

    const center = tileCenterLatLng(tile.id);

    if (!center) {
      continue;
    }

    const symbol =
      tile.settlement.type === "ruin"
        ? theme.settlements.ruin
        : theme.settlements.village;

    if (!detailLevelAtLeast(detailLevel, symbol.labelAtDetailLevel)) {
      continue;
    }

    L.circleMarker(center, {
      radius: symbol.size / 2,
      color: symbol.stroke,
      fillColor: symbol.fill,
      fillOpacity: 1,
      weight: 2,
      interactive: false,
    }).addTo(groups.settlementLayer);
  }

  for (const region of Object.values(world.settlementRegions)) {
    const boundaryStyle = theme.settlements.regionBoundaries[region.tier];
    const symbol =
      region.tier === "town"
        ? theme.settlements.town
        : region.tier === "expanse"
          ? theme.settlements.expanse
          : region.tier === "urban-region"
            ? theme.settlements.urban
            : region.tier === "quadrant"
              ? theme.settlements.quadrant
              : theme.settlements.sunder;

    const center = tileCenterLatLng(region.anchorTileId);

    if (
      center &&
      detailLevelAtLeast(detailLevel, symbol.labelAtDetailLevel)
    ) {
      L.circleMarker(center, {
        radius: symbol.size / 2,
        color: symbol.stroke,
        fillColor: symbol.fill,
        fillOpacity: 0.9,
        weight: 2,
        interactive: false,
      }).addTo(groups.settlementLayer);
    }

    if (
      detailLevelAtLeast(detailLevel, boundaryStyle.showAtDetailLevel) &&
      region.memberTileIds.length > 1
    ) {
      for (const tileId of region.memberTileIds) {
        const tile = world.tiles[tileId];

        if (!tile) {
          continue;
        }

        L.rectangle(tileBoundsToLatLngBounds(tile.x, tile.y), {
          color: boundaryStyle.stroke,
          weight: boundaryStyle.weight,
          dashArray: boundaryStyle.dashArray,
          fillOpacity: 0,
          interactive: false,
        }).addTo(groups.settlementLayer);
      }
    }
  }
}

function renderLabels(
  groups: MapLayerGroups,
  world: WorldState,
  theme: MapVisualTheme,
  options: MapVisualRenderOptions,
): void {
  const labels = resolveVisibleLabels(buildMapLabels(world), {
    detailLevel: options.detailLevel,
    selectedTileIds: options.selectedTileIds,
  });

  for (const label of labels) {
    const center = tileCenterLatLng(label.tileId);

    if (!center) {
      continue;
    }

    const style =
      label.type === "region" ? theme.labels.region : theme.labels.settlement;

    L.marker(center, {
      interactive: false,
      icon: L.divIcon({
        className: "nexus-map-label",
        html: `<span style="color:${style.fill};text-shadow:0 0 2px ${style.stroke}">${label.text}</span>`,
        iconSize: [0, 0],
      }),
    }).addTo(groups.labelLayer);
  }
}

function renderPreviewHighlights(
  groups: MapLayerGroups,
  world: WorldState,
  options: MapVisualRenderOptions,
): void {
  for (const tileId of getRenderableTileIds(world)) {
    const tile = world.tiles[tileId];

    if (!tile) {
      continue;
    }

    const style = resolvePreviewStyle(tileId, options.highlights, options.theme);

    if (!style) {
      continue;
    }

    L.rectangle(tileBoundsToLatLngBounds(tile.x, tile.y), {
      ...style,
      interactive: false,
    }).addTo(groups.previewLayer);
  }
}

export function renderVisualMap(
  map: L.Map,
  groups: MapLayerGroups,
  world: WorldState,
  options: MapVisualRenderOptions,
): void {
  ensurePatternDefinitions(map);

  const snapshot = getVisualWorldSnapshot(world);
  const worldBounds = getWorldBoundsOrDefault(world);
  const [southWest, northEast] = worldBoundsToLeafletBounds(worldBounds);

  L.rectangle(L.latLngBounds(southWest, northEast), {
    stroke: false,
    fillColor: options.theme.background.color,
    fillOpacity: 1,
    interactive: false,
  }).addTo(groups.backgroundLayer);

  for (const region of snapshot.terrainRegions) {
    renderTerrainRegion(groups, region, options.theme, options.devControls);
  }

  renderRoutes(groups, world, options.theme, options);
  renderSettlements(groups, world, options.theme, options.detailLevel);
  renderTileOverlays(groups, world, options.theme);
  renderLabels(groups, world, options.theme, options);
  renderPreviewHighlights(groups, world, options);
  renderPreviewRoute(groups, options.previewRoute ?? null, options.theme);
  renderInteractionTiles(groups, world, options.onSelectTile);

  if (
    detailLevelAtLeast(options.detailLevel, options.theme.grid.showAtDetailLevel) ||
    (options.isDevMode && options.devControls?.showLogicalTileGrid)
  ) {
    renderGridOverlay(groups, world, options.theme);
  }

  if (options.isDevMode && options.devControls?.showTerrainRegionIds) {
    for (const region of snapshot.terrainRegions) {
      const anchor = region.tileIds[0];
      const center = anchor ? tileCenterLatLng(anchor) : null;

      if (center) {
        L.marker(center, {
          icon: L.divIcon({
            className: "nexus-dev-region-id",
            html: `<span>${region.id}</span>`,
          }),
        }).addTo(groups.developmentLayer);
      }
    }
  }
}

export function getDetailLevelForMap(map: L.Map): MapDetailLevel {
  return getDetailLevelFromZoom(map.getZoom());
}

export function buildPreviewLegendEntries(
  highlights: TileHighlightState,
  theme: MapVisualTheme,
): string[] {
  const entries: string[] = [];
  const legend = theme.previews.legend;

  if (highlights.selected.size > 0) {
    entries.push(legend.selection ?? "Selection");
  }

  if (highlights.preview.size > 0) {
    entries.push(legend.expanded ?? "Direct target");
  }

  if (highlights.propagation?.affected.size) {
    entries.push(legend.propagationAffected ?? "Propagated effect");
  }

  if (highlights.propagation?.created.size) {
    entries.push(legend.propagationCreated ?? "New tile");
  }

  if (highlights.propagation?.blocked.size) {
    entries.push(legend.propagationBlocked ?? "Blocked");
  }

  if (highlights.consequencePreview.size > 0) {
    entries.push(legend.consequence ?? "Consequence");
  }

  return entries;
}
