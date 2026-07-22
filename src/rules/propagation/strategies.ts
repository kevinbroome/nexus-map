import { getTileId } from "../../world/coordinates";
import { getNeighbourCoordinates } from "../../world/neighbours";
import type { Coordinate } from "../../world/neighbours";
import type { WorldState } from "../../world/worldTypes";
import { getRoadNetworkTileIds } from "../targeting/regionMatch";
import { resolveDirection } from "../targeting/directions";
import { compareTileIds, manhattanDistance } from "../targeting/utils";
import { createSeededRandom, pickRandomItems } from "../random";
import { toTargetResolutionContext } from "./contextBridge";
import type {
  FrontierCandidate,
  PropagationContext,
  PropagationStrategyDefinition,
} from "./types";

export function getNeighbourMode(
  strategy: PropagationStrategyDefinition,
): "cardinal" | "all" {
  if (strategy.type === "directional" || strategy.type === "follow-network") {
    return "cardinal";
  }

  return strategy.neighbourMode ?? "cardinal";
}

export function collectNeighbourCoordinates(
  world: WorldState,
  fromTileId: string,
  mode: "cardinal" | "all",
): Coordinate[] {
  const tile = world.tiles[fromTileId];

  if (!tile) {
    return [];
  }

  return getNeighbourCoordinates(tile, mode === "all" ? "all" : "cardinal");
}

export function getNetworkTileSet(
  world: WorldState,
  seedTileIds: string[],
  routeType?: import("../../networks/networkTypes").TravelRouteType,
): Set<string> {
  const tileIds = new Set<string>();

  for (const seedTileId of seedTileIds) {
    for (const tileId of getRoadNetworkTileIds(world, seedTileId, routeType)) {
      tileIds.add(tileId);
    }
  }

  return tileIds;
}

export function filterCandidatesForStrategy(
  world: WorldState,
  candidates: FrontierCandidate[],
  strategy: PropagationStrategyDefinition,
  context: PropagationContext,
  _resolvedValues: Record<string, unknown>,
  networkTiles: Set<string>,
  resolvedDirection?: string,
): FrontierCandidate[] {
  switch (strategy.type) {
    case "follow-terrain":
      return candidates.filter((candidate) => {
        if (!candidate.tileId) {
          return false;
        }

        const tile = world.tiles[candidate.tileId];
        return tile ? strategy.terrains.includes(tile.terrain) : false;
      });

    case "follow-network":
      return candidates.filter(
        (candidate) => candidate.tileId && networkTiles.has(candidate.tileId),
      );

    case "directional": {
      const spread = strategy.spread ?? 0;
      const seedId = context.seedTileIds[0]!;

      return candidates.filter((candidate) => {
        if (!resolvedDirection) {
          return true;
        }

        const dx = candidate.coordinate.x - parseTile(candidate.fromTileId).x;
        const dy = candidate.coordinate.y - parseTile(candidate.fromTileId).y;
        const aligned = directionMatchesDelta(resolvedDirection, dx, dy);

        if (aligned) {
          return true;
        }

        return (
          spread > 0 &&
          manhattanDistance(
            seedId,
            candidate.tileId ?? getTileId(candidate.coordinate.x, candidate.coordinate.y),
          ) <= spread + 1
        );
      });
    }

    default:
      return candidates;
  }
}

export function chooseNextCandidate(
  candidates: FrontierCandidate[],
  strategy: PropagationStrategyDefinition,
  context: PropagationContext,
  stepSequence: number,
  resolvedValues: Record<string, unknown>,
): FrontierCandidate | null {
  if (candidates.length === 0) {
    return null;
  }

  const sorted = [...candidates].sort((left, right) => {
    if (left.distanceFromSeed !== right.distanceFromSeed) {
      return left.distanceFromSeed - right.distanceFromSeed;
    }

    if (left.accumulatedCost !== right.accumulatedCost) {
      return left.accumulatedCost - right.accumulatedCost;
    }

    if (left.coordinate.y !== right.coordinate.y) {
      return left.coordinate.y - right.coordinate.y;
    }

    return left.coordinate.x - right.coordinate.x;
  });

  switch (strategy.type) {
    case "breadth-first":
      return sorted[0] ?? null;

    case "weighted-frontier":
      return [...sorted].sort((left, right) => {
        if (left.accumulatedCost !== right.accumulatedCost) {
          return left.accumulatedCost - right.accumulatedCost;
        }

        return compareTileIds(
          left.tileId ?? getTileId(left.coordinate.x, left.coordinate.y),
          right.tileId ?? getTileId(right.coordinate.x, right.coordinate.y),
        );
      })[0] ?? null;

    case "random-frontier":
    case "random-walk": {
      const random = createSeededRandom(
        `${context.randomSeed}:propagation:${stepSequence}:${strategy.type}`,
      );
      const [picked] = pickRandomItems(sorted, 1, random);
      resolvedValues[`propagation.pick.${stepSequence}`] = picked;
      return picked ?? null;
    }

    case "directional":
    case "follow-terrain":
    case "follow-network":
      return sorted[0] ?? null;

    default: {
      const unreachable: never = strategy;
      throw new Error(`Unsupported strategy: ${String(unreachable)}`);
    }
  }
}

export function resolveStrategyDirectionSync(
  strategy: PropagationStrategyDefinition,
  context: PropagationContext,
  seedTileId: string,
  resolvedValues: Record<string, unknown>,
): { direction?: string; error?: string } {
  if (strategy.type !== "directional") {
    return {};
  }

  const result = resolveDirection(
    strategy.direction,
    toTargetResolutionContext(context),
    seedTileId,
    "propagation.direction",
  );

  if (result.error) {
    return { error: result.error };
  }

  Object.assign(resolvedValues, result.resolvedValues);
  return { direction: result.direction };
}

function parseTile(tileId: string): Coordinate {
  const [x, y] = tileId.split(",").map(Number);
  return { x: x!, y: y! };
}

function directionMatchesDelta(
  direction: string,
  dx: number,
  dy: number,
): boolean {
  switch (direction) {
    case "north":
      return dx === 0 && dy === -1;
    case "south":
      return dx === 0 && dy === 1;
    case "east":
      return dx === 1 && dy === 0;
    case "west":
      return dx === -1 && dy === 0;
    case "north-east":
      return dx === 1 && dy === -1;
    case "south-east":
      return dx === 1 && dy === 1;
    case "south-west":
      return dx === -1 && dy === 1;
    case "north-west":
      return dx === -1 && dy === -1;
    default:
      return false;
  }
}
