import L from "leaflet";

export interface MapLayerGroups {
  backgroundLayer: L.LayerGroup;
  terrainBaseLayer: L.LayerGroup;
  terrainBoundaryLayer: L.LayerGroup;
  terrainTextureLayer: L.LayerGroup;
  routeLayer: L.LayerGroup;
  settlementLayer: L.LayerGroup;
  overlayLayer: L.LayerGroup;
  labelLayer: L.LayerGroup;
  previewLayer: L.LayerGroup;
  selectionLayer: L.LayerGroup;
  interactionLayer: L.LayerGroup;
  developmentLayer: L.LayerGroup;
  previewRouteLayer: L.LayerGroup;
}

export function createMapLayerGroups(map: L.Map): MapLayerGroups {
  const groups: MapLayerGroups = {
    backgroundLayer: L.layerGroup(),
    terrainBaseLayer: L.layerGroup(),
    terrainBoundaryLayer: L.layerGroup(),
    terrainTextureLayer: L.layerGroup(),
    routeLayer: L.layerGroup(),
    settlementLayer: L.layerGroup(),
    overlayLayer: L.layerGroup(),
    labelLayer: L.layerGroup(),
    previewLayer: L.layerGroup(),
    selectionLayer: L.layerGroup(),
    interactionLayer: L.layerGroup(),
    developmentLayer: L.layerGroup(),
    previewRouteLayer: L.layerGroup(),
  };

  for (const layer of Object.values(groups)) {
    layer.addTo(map);
  }

  return groups;
}

export function clearMapLayerGroups(groups: MapLayerGroups): void {
  for (const layer of Object.values(groups)) {
    layer.clearLayers();
  }
}

export function setLayerGroupVisibility(
  map: L.Map,
  layer: L.LayerGroup,
  visible: boolean,
): void {
  if (visible) {
    if (!map.hasLayer(layer)) {
      layer.addTo(map);
    }
    return;
  }

  if (map.hasLayer(layer)) {
    layer.remove();
  }
}
