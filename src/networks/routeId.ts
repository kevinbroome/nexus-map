import type { TravelEndpoint, TravelRoute, TravelRouteType } from "./networkTypes";
import { canonicalizeEndpoints } from "./networkTypes";

function hashString(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(36);
}

export function createTravelRouteId(
  type: TravelRouteType,
  origin: TravelEndpoint,
  destination: TravelEndpoint,
  pathTileIds: string[],
): string {
  const [canonicalOrigin, canonicalDestination] = canonicalizeEndpoints(
    origin,
    destination,
  );

  const payload = [
    type,
    `${canonicalOrigin.type}:${canonicalOrigin.id}`,
    `${canonicalDestination.type}:${canonicalDestination.id}`,
    pathTileIds.join(">"),
  ].join("|");

  return `${type}-${hashString(payload)}`;
}

export function routesAreEquivalent(
  left: TravelRoute,
  right: TravelRoute,
): boolean {
  return left.id === right.id;
}
