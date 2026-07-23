export interface DevVisualControls {
  showLogicalTileGrid: boolean;
  showTerrainRegionIds: boolean;
  showRawTerrainPolygons: boolean;
  showSmoothedPolygons: boolean;
  showRouteTilePaths: boolean;
  showSmoothedRoads: boolean;
  showSettlementAnchors: boolean;
  showRegionMemberTiles: boolean;
  showLabelCollisionBoxes: boolean;
  showMissingCoordinates: boolean;
  showPreviewPipeline: boolean;
  disableBoundarySmoothing: boolean;
}

export const DEFAULT_DEV_VISUAL_CONTROLS: DevVisualControls = {
  showLogicalTileGrid: false,
  showTerrainRegionIds: false,
  showRawTerrainPolygons: false,
  showSmoothedPolygons: false,
  showRouteTilePaths: false,
  showSmoothedRoads: true,
  showSettlementAnchors: false,
  showRegionMemberTiles: false,
  showLabelCollisionBoxes: false,
  showMissingCoordinates: false,
  showPreviewPipeline: true,
  disableBoundarySmoothing: false,
};

let devVisualControls: DevVisualControls = { ...DEFAULT_DEV_VISUAL_CONTROLS };

export function getDevVisualControls(): DevVisualControls {
  return devVisualControls;
}

export function setDevVisualControl<K extends keyof DevVisualControls>(
  key: K,
  value: DevVisualControls[K],
): void {
  devVisualControls = {
    ...devVisualControls,
    [key]: value,
  };
}

export function resetDevVisualControls(): void {
  devVisualControls = { ...DEFAULT_DEV_VISUAL_CONTROLS };
}

export const DEV_VISUAL_CONTROL_OPTIONS: Array<{
  key: keyof DevVisualControls;
  label: string;
}> = [
  { key: "showLogicalTileGrid", label: "Show logical tile grid" },
  { key: "showTerrainRegionIds", label: "Show terrain region IDs" },
  { key: "showRawTerrainPolygons", label: "Show raw terrain polygons" },
  { key: "showSmoothedPolygons", label: "Show smoothed polygons" },
  { key: "showRouteTilePaths", label: "Show route tile paths" },
  { key: "showSmoothedRoads", label: "Show smoothed roads" },
  { key: "showSettlementAnchors", label: "Show settlement anchors" },
  { key: "showRegionMemberTiles", label: "Show region member tiles" },
  { key: "showLabelCollisionBoxes", label: "Show label collision boxes" },
  { key: "showMissingCoordinates", label: "Show missing coordinates" },
  { key: "showPreviewPipeline", label: "Show preview pipeline" },
  { key: "disableBoundarySmoothing", label: "Disable boundary smoothing" },
];
