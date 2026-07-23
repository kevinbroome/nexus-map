import type { ConditionDefinition } from "../../cards/cardTypes";
import { tileExists } from "../../world/coordinates";
import { getExistingNeighbours } from "../../world/neighbours";
import { isBoundaryTile } from "../../world/tileCreation";
import { endpointKey } from "../../networks/networkTypes";
import { areEndpointKeysDirectlyConnected } from "../../networks/settlementNetwork";
import { getRoutesThroughTile } from "../../networks/networkQueries";
import { findRegionsContainingTile } from "../../worldLaws/settlementHierarchy";
import { inferTravelEndpointFromTile } from "./settlementEndpoints";
import type { TargetFilterDefinition, TargetResolutionContext } from "./types";
import { distanceBetween } from "./utils";

export function conditionToFilter(
  condition: ConditionDefinition,
): TargetFilterDefinition {
  switch (condition.type) {
    case "terrain-is":
      return { type: "terrain-is", terrain: condition.terrain };
    case "terrain-is-not":
      return { type: "terrain-is-not", terrain: condition.terrain };
    case "has-settlement":
      return { type: "has-settlement" };
    case "has-no-settlement":
      return { type: "has-no-settlement" };
    case "adjacent-to-terrain":
      return {
        type: "adjacent-to-terrain",
        terrain: condition.terrain,
        mode: "cardinal",
      };
    case "minimum-neighbours":
      return {
        type: "minimum-neighbours",
        terrain: condition.terrain,
        count: condition.count,
        mode: "cardinal",
      };
    default: {
      const unreachable: never = condition;
      throw new Error(`Unsupported condition: ${String(unreachable)}`);
    }
  }
}

export function matchesTargetFilter(
  world: TargetResolutionContext["world"],
  tileId: string,
  filter: TargetFilterDefinition,
  context: {
    originTileId?: string;
    routeType?: import("../../networks/networkTypes").TravelRouteType;
  } = {},
): boolean {
  const tile = world.tiles[tileId];
  const exists = tile !== undefined;

  switch (filter.type) {
    case "tile-exists":
      return exists;

    case "tile-missing":
      return !exists;

    case "terrain-is":
      return exists && tile.terrain === filter.terrain;

    case "terrain-is-not":
      return exists && tile.terrain !== filter.terrain;

    case "terrain-in":
      return exists && filter.terrains.includes(tile.terrain);

    case "has-tag":
      return exists && tile.tags.includes(filter.tag);

    case "does-not-have-tag":
      return exists && !tile.tags.includes(filter.tag);

    case "has-settlement":
      return exists && tile.settlement !== undefined;

    case "has-no-settlement":
      return exists && tile.settlement === undefined;

    case "settlement-tier-is": {
      if (!exists || !tile.settlement) {
        return false;
      }

      if (filter.tier === "village") {
        return tile.settlement.type === "village";
      }

      if (filter.tier === "ruin") {
        return tile.settlement.type === "ruin";
      }

      return findRegionsContainingTile(world.settlementRegions, tileId).some(
        (region) => region.tier === filter.tier,
      );
    }

    case "settlement-region-tier-in":
      if (!exists) {
        return false;
      }

      return findRegionsContainingTile(world.settlementRegions, tileId).some(
        (region) => filter.tiers.includes(region.tier),
      );

    case "adjacent-to-terrain":
      if (!exists) {
        return false;
      }

      return getExistingNeighbours(world, tileId, filter.mode ?? "cardinal").some(
        (neighbour) => neighbour.terrain === filter.terrain,
      );

    case "minimum-neighbours":
      if (!exists) {
        return false;
      }

      return (
        getExistingNeighbours(world, tileId, filter.mode ?? "cardinal").filter(
          (neighbour) => neighbour.terrain === filter.terrain,
        ).length >= filter.count
      );

    case "is-boundary-tile":
      return exists && isBoundaryTile(world, tileId);

    case "is-connected-to-road":
      return (
        getRoutesThroughTile(world, tileId).filter((route) =>
          context.routeType ? route.type === context.routeType : route.type === "road",
        ).length > 0
      );

    case "is-not-connected-to-road": {
      if (!context.originTileId) {
        return true;
      }

      const originEndpoint = inferTravelEndpointFromTile(
        world,
        context.originTileId,
      );
      const candidateEndpoint = inferTravelEndpointFromTile(world, tileId);

      if (!originEndpoint || !candidateEndpoint) {
        return true;
      }

      return !areEndpointKeysDirectlyConnected(
        world,
        endpointKey(originEndpoint),
        endpointKey(candidateEndpoint),
        context.routeType ?? "road",
      );
    }

    case "distance-from-origin": {
      if (!context.originTileId) {
        return false;
      }

      const metric = filter.metric ?? "manhattan";
      const distance = distanceBetween(tileId, context.originTileId, metric);

      if (filter.minimum !== undefined && distance < filter.minimum) {
        return false;
      }

      if (filter.maximum !== undefined && distance > filter.maximum) {
        return false;
      }

      return true;
    }

    default: {
      const unreachable: never = filter;
      throw new Error(`Unsupported target filter: ${String(unreachable)}`);
    }
  }
}

export function applyTargetFilters(
  world: TargetResolutionContext["world"],
  candidateIds: string[],
  filters: TargetFilterDefinition[],
  context: {
    originTileId?: string;
    routeType?: import("../../networks/networkTypes").TravelRouteType;
  } = {},
): string[] {
  return candidateIds.filter((tileId) =>
    filters.every((filter) =>
      matchesTargetFilter(world, tileId, filter, context),
    ),
  );
}

export function describeFilterFailure(
  tileId: string,
  filter: TargetFilterDefinition,
): string {
  switch (filter.type) {
    case "terrain-is":
      return `Tile ${tileId} must be ${filter.terrain}.`;
    case "terrain-is-not":
      return `Tile ${tileId} cannot be ${filter.terrain}.`;
    case "has-settlement":
      return `Tile ${tileId} must have a settlement.`;
    case "has-no-settlement":
      return `Tile ${tileId} must not have a settlement.`;
    default:
      return `Tile ${tileId} failed filter "${filter.type}".`;
  }
}

export function tileIdExists(
  world: TargetResolutionContext["world"],
  tileId: string,
): boolean {
  return tileExists(
    world,
    Number(tileId.split(",")[0]),
    Number(tileId.split(",")[1]),
  );
}
