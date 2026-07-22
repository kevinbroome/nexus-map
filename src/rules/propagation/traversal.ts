import { getRoutesThroughTile } from "../../networks/networkQueries";
import type { MapTile, TerrainType, WorldState } from "../../world/worldTypes";
import { calculateResistance, isResistanceBlocking } from "./resistance";
import type {
  PropagationOperationDefinition,
  PropagationTraversalDefinition,
  ResistanceDefinition,
} from "./types";

const DEFAULT_TERRAIN_COSTS: Partial<Record<TerrainType, number>> = {
  empty: 1,
  grassland: 1,
  desert: 1,
  forest: 2,
  urban: 3,
  mountain: Number.POSITIVE_INFINITY,
  water: Number.POSITIVE_INFINITY,
  chasm: Number.POSITIVE_INFINITY,
};

export function validateTraversalDefinition(
  traversal?: PropagationTraversalDefinition,
): string[] {
  const messages: string[] = [];

  if (!traversal) {
    return messages;
  }

  for (const [terrain, cost] of Object.entries(traversal.terrainCosts ?? {})) {
    if (cost !== undefined && cost < 0 && cost !== Number.POSITIVE_INFINITY) {
      messages.push(`Traversal cost for ${terrain} cannot be negative.`);
    }
  }

  for (const [tag, cost] of Object.entries(traversal.tagCosts ?? {})) {
    if (cost < 0 && cost !== Number.POSITIVE_INFINITY) {
      messages.push(`Traversal cost for tag "${tag}" cannot be negative.`);
    }
  }

  if (
    traversal.roadCostMultiplier !== undefined &&
    traversal.roadCostMultiplier <= 0
  ) {
    messages.push("Road cost multiplier must be positive.");
  }

  if (
    traversal.settlementCostMultiplier !== undefined &&
    traversal.settlementCostMultiplier <= 0
  ) {
    messages.push("Settlement cost multiplier must be positive.");
  }

  if (
    traversal.matchingTerrainMultiplier !== undefined &&
    traversal.matchingTerrainMultiplier <= 0
  ) {
    messages.push("Matching terrain multiplier must be positive.");
  }

  return messages;
}

export function calculateTraversalCost(
  world: WorldState,
  tile: MapTile,
  options: {
    traversal?: PropagationTraversalDefinition;
    resistance?: ResistanceDefinition[];
    operation?: PropagationOperationDefinition;
    preferTerrain?: TerrainType;
  },
): number {
  const terrainCosts = {
    ...DEFAULT_TERRAIN_COSTS,
    ...options.traversal?.terrainCosts,
  };
  let cost = terrainCosts[tile.terrain] ?? Number.POSITIVE_INFINITY;

  if (!Number.isFinite(cost)) {
    return cost;
  }

  for (const [tag, tagCost] of Object.entries(options.traversal?.tagCosts ?? {})) {
    if (tile.tags.includes(tag)) {
      cost += tagCost;
    }
  }

  if (tile.settlement && options.traversal?.settlementCostMultiplier) {
    cost *= options.traversal.settlementCostMultiplier;
  }

  const routes = getRoutesThroughTile(world, tile.id);

  if (routes.length > 0 && options.traversal?.roadCostMultiplier) {
    cost *= options.traversal.roadCostMultiplier;
  }

  const matchingTerrain =
    options.preferTerrain ?? getOperationTerrain(options.operation);

  if (
    matchingTerrain &&
    tile.terrain === matchingTerrain &&
    options.traversal?.preferMatchingTerrain &&
    options.traversal.matchingTerrainMultiplier
  ) {
    cost *= options.traversal.matchingTerrainMultiplier;
  }

  const resistance = calculateResistance(world, tile, options.resistance ?? []);

  if (isResistanceBlocking(resistance)) {
    return Number.POSITIVE_INFINITY;
  }

  return cost + resistance;
}

function getOperationTerrain(
  operation?: PropagationOperationDefinition,
): TerrainType | undefined {
  return operation?.type === "set-terrain" ? operation.terrain : undefined;
}

export { DEFAULT_TERRAIN_COSTS };
