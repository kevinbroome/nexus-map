import { getWorldBoundsOrDefault } from "../../world/bounds";
import { getTileAt, getTileId } from "../../world/coordinates";
import type {
  CardinalDirection,
  DiagonalDirection,
  DirectionDefinition,
  TargetResolutionContext,
} from "./types";
import { createSeededRandom } from "../random";
import { compareTileIds, manhattanDistance } from "./utils";

const CARDINAL_DIRECTIONS: CardinalDirection[] = [
  "north",
  "east",
  "south",
  "west",
];

const ALL_DIRECTIONS: Array<CardinalDirection | DiagonalDirection> = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
];

function directionOffset(
  direction: CardinalDirection | DiagonalDirection,
): { x: number; y: number } {
  switch (direction) {
    case "north":
      return { x: 0, y: -1 };
    case "east":
      return { x: 1, y: 0 };
    case "south":
      return { x: 0, y: 1 };
    case "west":
      return { x: -1, y: 0 };
    case "north-east":
      return { x: 1, y: -1 };
    case "south-east":
      return { x: 1, y: 1 };
    case "south-west":
      return { x: -1, y: 1 };
    case "north-west":
      return { x: -1, y: -1 };
    default:
      return { x: 0, y: 0 };
  }
}

function findNearestSettlementTileId(
  world: TargetResolutionContext["world"],
  originTileId: string,
): string | null {
  const settlements = Object.values(world.tiles)
    .filter((tile) => tile.settlement !== undefined)
    .map((tile) => tile.id)
    .sort(compareTileIds);

  if (settlements.length === 0) {
    return null;
  }

  let nearest = settlements[0]!;
  let nearestDistance = manhattanDistance(originTileId, nearest);

  for (const candidate of settlements.slice(1)) {
    const distance = manhattanDistance(originTileId, candidate);

    if (
      distance < nearestDistance ||
      (distance === nearestDistance && compareTileIds(candidate, nearest) < 0)
    ) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }

  return nearest;
}

export type DirectionResolution = {
  direction: CardinalDirection | DiagonalDirection;
  resolvedValues: Record<string, unknown>;
  error?: string;
};

export function resolveDirection(
  definition: DirectionDefinition,
  context: TargetResolutionContext,
  originTileId: string,
  key: string,
): DirectionResolution {
  const origin = context.world.tiles[originTileId];

  if (!origin) {
    return {
      direction: "north",
      resolvedValues: {},
      error: `Direction origin tile "${originTileId}" does not exist.`,
    };
  }

  const bounds = getWorldBoundsOrDefault(context.world);
  const centreX = Math.round((bounds.minX + bounds.maxX) / 2);
  const centreY = Math.round((bounds.minY + bounds.maxY) / 2);
  const resolvedValues: Record<string, unknown> = {};

  switch (definition.type) {
    case "fixed":
      resolvedValues[`${key}.direction`] = definition.value;
      return { direction: definition.value, resolvedValues };

    case "random-cardinal": {
      const random = createSeededRandom(`${context.randomSeed}:${key}:cardinal`);
      const index = Math.floor(random() * CARDINAL_DIRECTIONS.length);
      const direction = CARDINAL_DIRECTIONS[index]!;
      resolvedValues[`${key}.direction`] = direction;
      return { direction, resolvedValues };
    }

    case "random-all": {
      const random = createSeededRandom(`${context.randomSeed}:${key}:all`);
      const index = Math.floor(random() * ALL_DIRECTIONS.length);
      const direction = ALL_DIRECTIONS[index]!;
      resolvedValues[`${key}.direction`] = direction;
      return { direction, resolvedValues };
    }

    case "toward-world-centre": {
      const dx = centreX - origin.x;
      const dy = centreY - origin.y;
      const direction = pickDominantDirection(dx, dy, true);
      resolvedValues[`${key}.direction`] = direction;
      return { direction, resolvedValues };
    }

    case "away-from-world-centre": {
      const dx = centreX - origin.x;
      const dy = centreY - origin.y;
      const direction = pickDominantDirection(dx, dy, false);
      resolvedValues[`${key}.direction`] = direction;
      return { direction, resolvedValues };
    }

    case "toward-nearest-settlement": {
      const nearest = findNearestSettlementTileId(context.world, originTileId);

      if (!nearest) {
        return {
          direction: "north",
          resolvedValues,
          error: "No settlement exists to resolve toward-nearest-settlement.",
        };
      }

      const target = context.world.tiles[nearest]!;
      const direction = pickDominantDirection(
        target.x - origin.x,
        target.y - origin.y,
        true,
      );
      resolvedValues[`${key}.direction`] = direction;
      resolvedValues[`${key}.nearestSettlement`] = nearest;
      return { direction, resolvedValues };
    }

    case "away-from-nearest-settlement": {
      const nearest = findNearestSettlementTileId(context.world, originTileId);

      if (!nearest) {
        return {
          direction: "north",
          resolvedValues,
          error: "No settlement exists to resolve away-from-nearest-settlement.",
        };
      }

      const target = context.world.tiles[nearest]!;
      const direction = pickDominantDirection(
        target.x - origin.x,
        target.y - origin.y,
        false,
      );
      resolvedValues[`${key}.direction`] = direction;
      resolvedValues[`${key}.nearestSettlement`] = nearest;
      return { direction, resolvedValues };
    }

    case "clockwise-from-previous":
    case "counter-clockwise-from-previous":
      return {
        direction: "north",
        resolvedValues,
        error: `${definition.type} requires previous direction history and is not supported yet.`,
      };

    default: {
      const unreachable: never = definition;
      return {
        direction: "north",
        resolvedValues,
        error: `Unsupported direction definition: ${String(unreachable)}`,
      };
    }
  }
}

function pickDominantDirection(
  dx: number,
  dy: number,
  toward: boolean,
): CardinalDirection {
  const signX = toward ? Math.sign(dx) : -Math.sign(dx);
  const signY = toward ? Math.sign(dy) : -Math.sign(dy);

  if (Math.abs(dx) >= Math.abs(dy)) {
    if (signX > 0) {
      return "east";
    }

    if (signX < 0) {
      return "west";
    }
  }

  if (signY > 0) {
    return "south";
  }

  if (signY < 0) {
    return "north";
  }

  return "north";
}

export function stepInDirection(
  originTileId: string,
  direction: CardinalDirection | DiagonalDirection,
  steps: number,
): string[] {
  const parts = originTileId.split(",");
  const offset = directionOffset(direction);
  const path: string[] = [];
  let x = Number(parts[0]);
  let y = Number(parts[1]);

  for (let step = 0; step < steps; step++) {
    x += offset.x;
    y += offset.y;
    path.push(getTileId(x, y));
  }

  return path;
}

export function findNearestSettlementEndpoint(
  world: TargetResolutionContext["world"],
  originTileId: string,
  options: { excludeOrigin?: boolean; maximumDistance?: number } = {},
): string | null {
  const candidates = Object.values(world.tiles)
    .filter((tile) => {
      if (!tile.settlement) {
        return false;
      }

      if (options.excludeOrigin && tile.id === originTileId) {
        return false;
      }

      if (
        options.maximumDistance !== undefined &&
        manhattanDistance(originTileId, tile.id) > options.maximumDistance
      ) {
        return false;
      }

      return true;
    })
    .map((tile) => tile.id)
    .sort(compareTileIds);

  if (candidates.length === 0) {
    return null;
  }

  let nearest = candidates[0]!;
  let nearestDistance = manhattanDistance(originTileId, nearest);

  for (const candidate of candidates.slice(1)) {
    const distance = manhattanDistance(originTileId, candidate);

    if (
      distance < nearestDistance ||
      (distance === nearestDistance && compareTileIds(candidate, nearest) < 0)
    ) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }

  return nearest;
}

export function getWorldCentreTileId(
  world: TargetResolutionContext["world"],
): string {
  const bounds = getWorldBoundsOrDefault(world);
  const x = Math.round((bounds.minX + bounds.maxX) / 2);
  const y = Math.round((bounds.minY + bounds.maxY) / 2);
  const existing = getTileAt(world, x, y);

  if (existing) {
    return existing.id;
  }

  return getTileId(x, y);
}
