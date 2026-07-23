import L from "leaflet";
import { TILE_SIZE } from "../../map/mapConfig";
import type { Coordinate } from "../geometry/types";

export function worldCoordinateToLatLng(point: Coordinate): L.LatLng {
  return L.latLng(point.y * TILE_SIZE, point.x * TILE_SIZE);
}

export function tileBoundsToLatLngBounds(
  x: number,
  y: number,
): L.LatLngBounds {
  return L.latLngBounds(
    [y * TILE_SIZE, x * TILE_SIZE],
    [(y + 1) * TILE_SIZE, (x + 1) * TILE_SIZE],
  );
}

export function ringToLatLngs(points: Coordinate[]): L.LatLngExpression[] {
  return points.map((point) => worldCoordinateToLatLng(point));
}

export function polygonToLatLngs(rings: Coordinate[][]): L.LatLngExpression[][] {
  return rings.map((ring) => ringToLatLngs(ring));
}

export function tileCenterLatLng(tileId: string): L.LatLng | null {
  const [xText, yText] = tileId.split(",");
  const x = Number(xText);
  const y = Number(yText);

  if (Number.isNaN(x) || Number.isNaN(y)) {
    return null;
  }

  return L.latLng((y + 0.5) * TILE_SIZE, (x + 0.5) * TILE_SIZE);
}
