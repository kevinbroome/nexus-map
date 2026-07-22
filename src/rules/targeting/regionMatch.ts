import type { MapTile, WorldState } from "../../world/worldTypes";
import { isRuinSettlement, isVillageSettlement } from "../../world/worldTypes";
import {
  getConnectedRegion,
  hasTag,
  matchesTerrain,
} from "../../world/neighbours";
import { getRoutesThroughTile } from "../../networks/networkQueries";
import { endpointKey } from "../../networks/networkTypes";
import { inferTravelEndpointFromTile } from "./settlementEndpoints";
import type { RegionMatchDefinition } from "./types";

export function createRegionMatcher(
  world: WorldState,
  match: RegionMatchDefinition,
  originTileId?: string,
): (tile: MapTile) => boolean {
  switch (match.type) {
    case "same-terrain-as-origin": {
      const origin = originTileId ? world.tiles[originTileId] : undefined;

      if (!origin) {
        return () => false;
      }

      return matchesTerrain(origin.terrain);
    }

    case "terrain":
      return matchesTerrain(match.terrain);

    case "same-tag":
      return hasTag(match.tag);

    case "settlement-tiles":
      return (tile) => tile.settlement !== undefined;

    case "ruin-tiles":
      return (tile) => isRuinSettlement(tile.settlement);

    case "road-network":
      return (tile) => {
        const routes = getRoutesThroughTile(world, tile.id).filter((route) =>
          match.routeType ? route.type === match.routeType : true,
        );
        return routes.length > 0;
      };

    default: {
      const unreachable: never = match;
      return () => {
        throw new Error(`Unsupported region match: ${String(unreachable)}`);
      };
    }
  }
}

export function getConnectedRegionTileIds(
  world: WorldState,
  startingTileId: string,
  match: RegionMatchDefinition,
  connection: "cardinal" | "all" = "cardinal",
): string[] {
  const matcher = createRegionMatcher(world, match, startingTileId);
  return getConnectedRegion(world, startingTileId, matcher, connection).map(
    (tile) => tile.id,
  );
}

export function getRoadNetworkTileIds(
  world: WorldState,
  originTileId: string,
  routeType?: import("../../networks/networkTypes").TravelRouteType,
): string[] {
  const endpoint = inferTravelEndpointFromTile(world, originTileId);
  const originKey = endpoint ? endpointKey(endpoint) : `tile:${originTileId}`;
  const tileIds = new Set<string>();

  for (const route of Object.values(world.travelRoutes)) {
    if (routeType && route.type !== routeType) {
      continue;
    }

    const keys = [endpointKey(route.origin), endpointKey(route.destination)];

    if (keys.includes(originKey)) {
      for (const tileId of route.pathTileIds) {
        tileIds.add(tileId);
      }
    }
  }

  if (tileIds.size === 0) {
    const routesThroughOrigin = getRoutesThroughTile(world, originTileId).filter(
      (route) => (routeType ? route.type === routeType : true),
    );

    for (const route of routesThroughOrigin) {
      for (const tileId of route.pathTileIds) {
        tileIds.add(tileId);
      }
    }
  }

  return [...tileIds].sort((left, right) => left.localeCompare(right));
}

export function getSettlementTierRank(
  world: WorldState,
  tileId: string,
): number {
  const tile = world.tiles[tileId];

  if (!tile?.settlement) {
    return -1;
  }

  if (isVillageSettlement(tile.settlement)) {
    return 1;
  }

  if (isRuinSettlement(tile.settlement)) {
    return 0;
  }

  return -1;
}

export function getRegionTierRank(
  world: WorldState,
  tileId: string,
): number {
  const tileRank = getSettlementTierRank(world, tileId);
  let highest = tileRank;

  for (const region of Object.values(world.settlementRegions)) {
    if (!region.memberTileIds.includes(tileId)) {
      continue;
    }

    const tierRank =
      region.tier === "town"
        ? 2
        : region.tier === "expanse"
          ? 3
          : region.tier === "urban-region"
            ? 4
            : region.tier === "quadrant"
              ? 5
              : 6;
    highest = Math.max(highest, tierRank);
  }

  return highest;
}
