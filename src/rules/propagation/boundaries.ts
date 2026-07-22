import { getTileId, tileExists } from "../../world/coordinates";
import { getNeighbourCoordinates } from "../../world/neighbours";
import type { Coordinate } from "../../world/neighbours";
import { normalizeMapTile } from "../../world/tileUtils";
import type { MapTile, TerrainType, WorldState } from "../../world/worldTypes";
import { resolveNumber } from "../targeting/numbers";
import { calculateTraversalCost } from "./traversal";
import { toTargetResolutionContext } from "./contextBridge";
import type {
  BoundaryBehaviourDefinition,
  FrontierCandidate,
  PropagationContext,
  PropagationOperationDefinition,
  PropagationTraversalDefinition,
  ResistanceDefinition,
} from "./types";

export type BoundaryResolution =
  | { action: "stop"; reason: string }
  | { action: "discard"; reason: string }
  | {
      action: "create";
      tile: MapTile;
      reason?: string;
    }
  | {
      action: "redirect";
      coordinate: Coordinate;
      tile?: MapTile;
      reason?: string;
    };

export function resolveBoundary(
  world: WorldState,
  coordinate: Coordinate,
  fromTileId: string,
  boundary: BoundaryBehaviourDefinition | undefined,
  context: PropagationContext,
  operation: PropagationOperationDefinition,
  createdCount: number,
  resolvedValues: Record<string, unknown>,
  traversal?: PropagationTraversalDefinition,
  resistance?: ResistanceDefinition[],
): BoundaryResolution {
  const effectiveBoundary = boundary ?? { type: "stop" as const };

  if (tileExists(world, coordinate.x, coordinate.y)) {
    const tile = world.tiles[getTileId(coordinate.x, coordinate.y)]!;
    return { action: "create", tile };
  }

  switch (effectiveBoundary.type) {
    case "stop":
      return {
        action: "stop",
        reason: "Propagation stopped at missing coordinate.",
      };

    case "discard-overflow":
      return {
        action: "discard",
        reason: "Missing coordinate discarded.",
      };

    case "create-blank-tiles":
    case "create-operation-terrain": {
      const maxDefinition = effectiveBoundary.maximumNewTiles;

      if (maxDefinition) {
        const maxResult = resolveNumber(
          maxDefinition,
          toTargetResolutionContext(context),
          "propagation.boundary.maximumNewTiles",
          { minimum: 0 },
        );

        if (maxResult.error) {
          return { action: "stop", reason: maxResult.error };
        }

        Object.assign(resolvedValues, maxResult.resolvedValues);

        if (createdCount >= maxResult.value) {
          return {
            action: "stop",
            reason: `Maximum new tile limit of ${maxResult.value} reached.`,
          };
        }
      }

      const terrain: TerrainType =
        effectiveBoundary.type === "create-blank-tiles"
          ? (effectiveBoundary.terrain ?? "empty")
          : operation.type === "set-terrain"
            ? operation.terrain
            : "empty";
      const id = getTileId(coordinate.x, coordinate.y);

      return {
        action: "create",
        tile: normalizeMapTile({
          id,
          x: coordinate.x,
          y: coordinate.y,
          terrain,
          tags: [],
          properties: {},
        }),
      };
    }

    case "redirect": {
      if (
        effectiveBoundary.direction === "clockwise" ||
        effectiveBoundary.direction === "counter-clockwise"
      ) {
        return {
          action: "stop",
          reason: `${effectiveBoundary.direction} redirect is not supported yet.`,
        };
      }

      const fromTile = world.tiles[fromTileId];

      if (!fromTile) {
        return { action: "stop", reason: "Redirect origin tile is missing." };
      }

      const neighbours = getNeighbourCoordinates(fromTile, "cardinal")
        .filter((entry) => !tileExists(world, entry.x, entry.y))
        .map((entry) => ({
          coordinate: entry,
          cost: Number.POSITIVE_INFINITY,
        }));

      const existingNeighbours = getNeighbourCoordinates(fromTile, "cardinal")
        .filter((entry) => tileExists(world, entry.x, entry.y))
        .map((entry) => {
          const tile = world.tiles[getTileId(entry.x, entry.y)]!;

          return {
            coordinate: entry,
            cost: calculateTraversalCost(world, tile, {
              traversal,
              resistance,
              operation,
            }),
          };
        })
        .filter((entry) => Number.isFinite(entry.cost));

      const options = [...existingNeighbours, ...neighbours].sort((left, right) => {
        if (left.cost !== right.cost) {
          return left.cost - right.cost;
        }

        if (left.coordinate.y !== right.coordinate.y) {
          return left.coordinate.y - right.coordinate.y;
        }

        return left.coordinate.x - right.coordinate.x;
      });

      const next = options[0];

      if (!next || !Number.isFinite(next.cost)) {
        return { action: "stop", reason: "No valid redirect direction found." };
      }

      if (tileExists(world, next.coordinate.x, next.coordinate.y)) {
        return {
          action: "redirect",
          coordinate: next.coordinate,
          tile: world.tiles[getTileId(next.coordinate.x, next.coordinate.y)],
          reason: "Redirected to lowest-cost neighbour.",
        };
      }

      return {
        action: "stop",
        reason: "Redirect reached missing coordinate.",
      };
    }

    default: {
      const unreachable: never = effectiveBoundary;
      return {
        action: "stop",
        reason: `Unsupported boundary behaviour: ${String(unreachable)}`,
      };
    }
  }
}

export function candidateFromTile(
  tile: MapTile,
  fromTileId: string,
  traversalCost: number,
  accumulatedCost: number,
  distanceFromSeed: number,
  createdTile: boolean,
): FrontierCandidate {
  return {
    coordinate: { x: tile.x, y: tile.y },
    tileId: tile.id,
    fromTileId,
    traversalCost,
    accumulatedCost,
    distanceFromSeed,
    createdTile,
  };
}
