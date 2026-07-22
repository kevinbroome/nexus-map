import type { WorldState } from "../world/worldTypes";
import { isVillageSettlement } from "../world/worldTypes";
import { getExistingNeighbourIds } from "../world/neighbours";
import type { TravelEndpoint, TravelRouteType } from "./networkTypes";
import { endpointKey } from "./networkTypes";
import { resolveTravelEndpoint } from "./endpoints";
import { getAllRoutes } from "./networkQueries";

export function areEndpointsDirectlyConnected(
  world: WorldState,
  firstEndpointId: string,
  secondEndpointId: string,
  routeType?: TravelRouteType,
): boolean {
  return getAllRoutes(world).some((route) => {
    if (routeType && route.type !== routeType) {
      return false;
    }

    const keys = [endpointKey(route.origin), endpointKey(route.destination)];

    return keys.includes(firstEndpointId) && keys.includes(secondEndpointId);
  });
}

export function areEndpointKeysDirectlyConnected(
  world: WorldState,
  firstKey: string,
  secondKey: string,
  routeType?: TravelRouteType,
): boolean {
  return getAllRoutes(world).some((route) => {
    if (routeType && route.type !== routeType) {
      return false;
    }

    const keys = [endpointKey(route.origin), endpointKey(route.destination)];
    return keys.includes(firstKey) && keys.includes(secondKey);
  });
}

export function getConnectedEndpointIds(
  world: WorldState,
  startingEndpointId: string,
  routeType?: TravelRouteType,
): string[] {
  const visited = new Set<string>();
  const queue = [startingEndpointId];
  visited.add(startingEndpointId);

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const route of getAllRoutes(world)) {
      if (routeType && route.type !== routeType) {
        continue;
      }

      const originKey = endpointKey(route.origin);
      const destinationKey = endpointKey(route.destination);
      let neighbourKey: string | null = null;

      if (originKey === current) {
        neighbourKey = destinationKey;
      } else if (destinationKey === current) {
        neighbourKey = originKey;
      }

      if (neighbourKey && !visited.has(neighbourKey)) {
        visited.add(neighbourKey);
        queue.push(neighbourKey);
      }
    }
  }

  return [...visited].sort();
}

function collectSettlementEndpoints(world: WorldState): TravelEndpoint[] {
  const endpoints: TravelEndpoint[] = [];

  for (const tile of Object.values(world.tiles)) {
    if (isVillageSettlement(tile.settlement)) {
      endpoints.push(resolveTravelEndpoint(world, "village", tile.id));
    }
  }

  for (const region of Object.values(world.settlementRegions)) {
    endpoints.push(
      resolveTravelEndpoint(world, "settlement-region", region.id),
    );
  }

  endpoints.sort((left, right) => endpointKey(left).localeCompare(endpointKey(right)));

  return endpoints;
}

export function findDisconnectedSettlementEndpoints(
  world: WorldState,
): TravelEndpoint[] {
  const endpoints = collectSettlementEndpoints(world);

  return endpoints.filter((endpoint) => {
    const key = endpointKey(endpoint);
    const connectedIds = getConnectedEndpointIds(world, key, "road");
    return connectedIds.length <= 1;
  });
}

export function getSettlementConnectionCount(
  world: WorldState,
  endpointId: string,
): number {
  return Math.max(0, getConnectedEndpointIds(world, endpointId, "road").length - 1);
}

export function isSettlementConnectedToNetwork(
  world: WorldState,
  endpointId: string,
): boolean {
  return getSettlementConnectionCount(world, endpointId) > 0;
}

export function pathSegmentsAreCardinallyAdjacent(
  world: WorldState,
  pathTileIds: string[],
): boolean {
  for (let index = 0; index < pathTileIds.length - 1; index++) {
    const currentId = pathTileIds[index]!;
    const nextId = pathTileIds[index + 1]!;
    const currentTile = world.tiles[currentId];

    if (!currentTile) {
      return false;
    }

    const neighbourIds = getExistingNeighbourIds(world, currentTile, "cardinal");
    if (!neighbourIds.includes(nextId)) {
      return false;
    }
  }

  return true;
}
