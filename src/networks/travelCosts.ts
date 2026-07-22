import type { TerrainType, WorldState } from "../world/worldTypes";
import type { TravelRouteType } from "./networkTypes";
import {
  EXISTING_ROUTE_COST_MULTIPLIER,
  MINIMUM_TRAVERSAL_COST,
  ROAD_TERRAIN_COSTS,
} from "./networkTypes";
import { getRoutesThroughTile } from "./networkQueries";

export function getTerrainTravelCost(
  terrain: TerrainType,
  terrainCosts: Partial<Record<TerrainType, number>> = ROAD_TERRAIN_COSTS,
): number {
  return terrainCosts[terrain] ?? Number.POSITIVE_INFINITY;
}

export function getTileTraversalCost(
  world: WorldState,
  tileId: string,
  options: {
    routeType: TravelRouteType;
    terrainCosts?: Partial<Record<TerrainType, number>>;
    allowExistingRoutesBonus?: boolean;
  },
): number {
  const tile = world.tiles[tileId];

  if (!tile) {
    return Number.POSITIVE_INFINITY;
  }

  const terrainCosts = options.terrainCosts ?? ROAD_TERRAIN_COSTS;
  let cost = getTerrainTravelCost(tile.terrain, terrainCosts);

  if (!Number.isFinite(cost)) {
    return cost;
  }

  if (options.allowExistingRoutesBonus) {
    const existingRoutes = getRoutesThroughTile(world, tileId).filter(
      (route) => route.type === options.routeType,
    );

    if (existingRoutes.length > 0) {
      cost = Math.max(
        MINIMUM_TRAVERSAL_COST,
        cost * EXISTING_ROUTE_COST_MULTIPLIER,
      );
    }
  }

  return cost;
}
