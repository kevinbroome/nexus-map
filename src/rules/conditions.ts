import type { ConditionDefinition } from "../cards/cardTypes";
import { getExistingNeighbours } from "../world/neighbours";
import type { MapTile, WorldState } from "../world/worldTypes";

function countNeighboursWithTerrain(
  world: WorldState,
  tile: MapTile,
  terrain: MapTile["terrain"],
): number {
  return getExistingNeighbours(world, tile.id, "cardinal").filter(
    (neighbour) => neighbour.terrain === terrain,
  ).length;
}

export function evaluateCondition(
  world: WorldState,
  tile: MapTile,
  condition: ConditionDefinition,
): boolean {
  switch (condition.type) {
    case "terrain-is":
      return tile.terrain === condition.terrain;

    case "terrain-is-not":
      return tile.terrain !== condition.terrain;

    case "has-settlement":
      return tile.settlement !== undefined;

    case "has-no-settlement":
      return tile.settlement === undefined;

    case "adjacent-to-terrain":
      return getExistingNeighbours(world, tile.id, "cardinal").some(
        (neighbour) => neighbour.terrain === condition.terrain,
      );

    case "minimum-neighbours":
      return (
        countNeighboursWithTerrain(world, tile, condition.terrain) >=
        condition.count
      );

    default: {
      const unreachable: never = condition;
      throw new Error(`Unsupported condition: ${String(unreachable)}`);
    }
  }
}

export function describeConditionFailure(
  tile: MapTile,
  condition: ConditionDefinition,
): string {
  switch (condition.type) {
    case "terrain-is":
      return `Tile ${tile.x},${tile.y} must be ${condition.terrain}.`;
    case "terrain-is-not":
      return `Tile ${tile.x},${tile.y} cannot be ${condition.terrain}.`;
    case "has-settlement":
      return `Tile ${tile.x},${tile.y} must have a settlement.`;
    case "has-no-settlement":
      return `Tile ${tile.x},${tile.y} already has a settlement.`;
    case "adjacent-to-terrain":
      return `Tile ${tile.x},${tile.y} must be adjacent to ${condition.terrain}.`;
    case "minimum-neighbours":
      return `Tile ${tile.x},${tile.y} needs at least ${condition.count} neighbouring ${condition.terrain} tiles.`;
    default:
      return `Tile ${tile.x},${tile.y} failed a condition.`;
  }
}

export function evaluateConditions(
  world: WorldState,
  tile: MapTile,
  conditions: ConditionDefinition[],
): { valid: boolean; messages: string[] } {
  const messages: string[] = [];

  for (const condition of conditions) {
    if (!evaluateCondition(world, tile, condition)) {
      messages.push(describeConditionFailure(tile, condition));
    }
  }

  return {
    valid: messages.length === 0,
    messages,
  };
}
