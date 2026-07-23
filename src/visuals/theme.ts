import type { TravelRouteType } from "../networks/networkTypes";
import type { SettlementTier, TerrainType } from "../world/worldTypes";

export type MapDetailLevel = "world" | "regional" | "local";

export interface TerrainVisualStyle {
  baseColor: string;
  borderColor?: string;
  textureId?: string;
  patternId?: string;
  opacity?: number;
  coastline?: CoastlineVisualStyle;
  boundary?: TerrainBoundaryVisualStyle;
}

export interface CoastlineVisualStyle {
  outerStroke: string;
  outerWeight: number;
  innerStroke?: string;
  innerWeight?: number;
}

export interface TerrainBoundaryVisualStyle {
  stroke: string;
  weight: number;
  dashArray?: string;
  smoothing?: BoundarySmoothingPreset;
}

export type BoundarySmoothingPreset = "none" | "soft" | "coastline" | "angular";

export interface GridVisualStyle {
  showAtDetailLevel: MapDetailLevel;
  stroke: string;
  weight: number;
  opacity: number;
}

export interface RouteVisualStyle {
  outerColor: string;
  outerWeight: number;
  innerColor: string;
  innerWeight: number;
  opacity: number;
  dashArray?: string;
  previewDashArray?: string;
  markerAtEndpoints: boolean;
  markerAtIntersections: boolean;
}

export interface SettlementSymbolStyle {
  shape: "dot" | "ring" | "cluster" | "block" | "multi" | "rare" | "ruin";
  fill: string;
  stroke: string;
  size: number;
  labelAtDetailLevel: MapDetailLevel;
}

export interface SettlementRegionBoundaryStyle {
  stroke: string;
  weight: number;
  dashArray?: string;
  showAtDetailLevel: MapDetailLevel;
}

export interface SettlementVisualTheme {
  village: SettlementSymbolStyle;
  town: SettlementSymbolStyle;
  expanse: SettlementSymbolStyle;
  urban: SettlementSymbolStyle;
  quadrant: SettlementSymbolStyle;
  sunder: SettlementSymbolStyle;
  ruin: SettlementSymbolStyle;
  regionBoundaries: Record<SettlementTier, SettlementRegionBoundaryStyle>;
}

export interface RuinVisualStyle {
  overlayPatternId: string;
  markerStroke: string;
  markerFill: string;
  clusterBoundaryStroke: string;
}

export interface PreviewRoleStyle {
  borderColor: string;
  borderWeight: number;
  fillColor?: string;
  fillOpacity?: number;
  dashArray?: string;
}

export interface PreviewVisualTheme {
  selection: PreviewRoleStyle;
  primaryTarget: PreviewRoleStyle;
  secondaryTarget: PreviewRoleStyle;
  origin: PreviewRoleStyle;
  candidate: PreviewRoleStyle;
  expanded: PreviewRoleStyle;
  propagationSeed: PreviewRoleStyle;
  propagationAffected: PreviewRoleStyle;
  propagationCreated: PreviewRoleStyle;
  propagationBlocked: PreviewRoleStyle;
  consequence: PreviewRoleStyle;
  legend: Record<string, string>;
}

export interface LabelVisualTheme {
  settlement: { fill: string; stroke: string; fontSize: number };
  region: { fill: string; stroke: string; fontSize: number };
  route: { fill: string; stroke: string; fontSize: number };
}

export interface MapBackgroundStyle {
  color: string;
  textureOpacity: number;
}

export interface MapVisualTheme {
  id: string;
  name: string;
  background: MapBackgroundStyle;
  terrain: Record<TerrainType, TerrainVisualStyle>;
  grid: GridVisualStyle;
  roads: Record<TravelRouteType, RouteVisualStyle>;
  settlements: SettlementVisualTheme;
  ruins: RuinVisualStyle;
  previews: PreviewVisualTheme;
  labels: LabelVisualTheme;
  performance: VisualPerformanceLimits;
}

export interface VisualPerformanceLimits {
  maxSmoothingIterations: number;
  maxPointsPerRegion: number;
  minRegionTilesForSmoothing: number;
}

export interface BoundarySmoothingOptions {
  enabled: boolean;
  iterations: number;
  strength: number;
  preserveCorners?: boolean;
}

export function getTerrainVisualStyle(
  terrain: TerrainType,
  theme: MapVisualTheme,
): TerrainVisualStyle {
  return theme.terrain[terrain];
}
