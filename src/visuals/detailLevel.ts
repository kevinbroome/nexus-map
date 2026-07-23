import type { MapDetailLevel } from "./theme";

export interface DetailLevelThresholds {
  regionalMinZoom: number;
  localMinZoom: number;
}

export const DEFAULT_DETAIL_THRESHOLDS: DetailLevelThresholds = {
  regionalMinZoom: -1,
  localMinZoom: 1,
};

export function getDetailLevelFromZoom(
  zoom: number,
  thresholds: DetailLevelThresholds = DEFAULT_DETAIL_THRESHOLDS,
): MapDetailLevel {
  if (zoom >= thresholds.localMinZoom) {
    return "local";
  }

  if (zoom >= thresholds.regionalMinZoom) {
    return "regional";
  }

  return "world";
}

export function detailLevelAtLeast(
  current: MapDetailLevel,
  required: MapDetailLevel,
): boolean {
  const order: MapDetailLevel[] = ["world", "regional", "local"];
  return order.indexOf(current) >= order.indexOf(required);
}
