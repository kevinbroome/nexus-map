import type { WorldState } from "../world/worldTypes";
import type { TravelRoute, TravelRouteType } from "./networkTypes";
import { endpointKey } from "./networkTypes";

export function getRoute(
  world: WorldState,
  routeId: string,
): TravelRoute | undefined {
  return world.travelRoutes[routeId];
}

export function getAllRoutes(world: WorldState): TravelRoute[] {
  return Object.values(world.travelRoutes).sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

export function getRoutesThroughTile(
  world: WorldState,
  tileId: string,
): TravelRoute[] {
  return getAllRoutes(world).filter((route) => route.pathTileIds.includes(tileId));
}

export function getRoutesConnectedToEndpoint(
  world: WorldState,
  endpointId: string,
): TravelRoute[] {
  return getAllRoutes(world).filter(
    (route) => route.origin.id === endpointId || route.destination.id === endpointId,
  );
}

export function getRoutesForEndpointKey(
  world: WorldState,
  endpoint: { type: string; id: string },
): TravelRoute[] {
  const key = endpointKey(endpoint as TravelRoute["origin"]);

  return getAllRoutes(world).filter((route) => {
    return (
      endpointKey(route.origin) === key || endpointKey(route.destination) === key
    );
  });
}

export function getRouteTypeFilter(
  routeType?: TravelRouteType,
): (route: TravelRoute) => boolean {
  if (!routeType) {
    return () => true;
  }

  return (route) => route.type === routeType;
}
