import { getCoordinatesWithinDistance, getExistingNeighbours, getExistingTilesWithinGraphSteps } from "../../world/neighbours";
import { parseTileId } from "../../world/coordinates";
import { resolveDirection, stepInDirection } from "./directions";
import { getConnectedRegionTileIds } from "./regionMatch";
import { resolveNumber } from "./numbers";
import type {
  TargetExpansionDefinition,
  TargetResolutionContext,
} from "./types";
import { coordinateIds, dedupeTileIds, sortTileIds } from "./utils";
import { createSeededRandom, pickRandomItems } from "../random";

export function applyExpansion(
  definition: TargetExpansionDefinition | undefined,
  context: TargetResolutionContext,
  selectedIds: string[],
  originTileId: string,
  key = "expansion",
): {
  expandedTargetIds: string[];
  resolvedValues: Record<string, unknown>;
  error?: string;
} {
  const expansion = definition ?? { type: "none" as const };
  const resolvedValues: Record<string, unknown> = {};

  if (expansion.type === "none") {
    return { expandedTargetIds: sortTileIds(selectedIds), resolvedValues };
  }

  const expanded = new Set<string>();

  switch (expansion.type) {
    case "plus": {
      const radiusResult = resolveNumber(expansion.radius, context, `${key}.radius`, {
        minimum: 0,
      });

      if (radiusResult.error) {
        return { expandedTargetIds: [], resolvedValues, error: radiusResult.error };
      }

      Object.assign(resolvedValues, radiusResult.resolvedValues);

      for (const selectedId of selectedIds) {
        const region = getExistingTilesWithinGraphSteps(
          context.world,
          selectedId,
          radiusResult.value,
          "cardinal",
        ).map((tile) => tile.id);

        for (const tileId of region) {
          expanded.add(tileId);
        }
      }

      if (!expansion.includeCentre) {
        for (const selectedId of selectedIds) {
          expanded.delete(selectedId);
        }
      }

      break;
    }

    case "square":
    case "diamond": {
      const radiusResult = resolveNumber(expansion.radius, context, `${key}.radius`, {
        minimum: 0,
      });

      if (radiusResult.error) {
        return { expandedTargetIds: [], resolvedValues, error: radiusResult.error };
      }

      Object.assign(resolvedValues, radiusResult.resolvedValues);
      const metric = expansion.type === "square" ? "chebyshev" : "manhattan";

      for (const selectedId of selectedIds) {
        const origin = parseTileId(selectedId);
        const coordinates = getCoordinatesWithinDistance(origin, radiusResult.value, {
          metric,
          includeOrigin: expansion.includeCentre ?? true,
        });

        for (const tileId of coordinateIds(coordinates)) {
          if (context.world.tiles[tileId]) {
            expanded.add(tileId);
          }
        }
      }

      break;
    }

    case "line": {
      const lengthResult = resolveNumber(expansion.length, context, `${key}.length`, {
        minimum: 1,
        requirePositive: true,
      });

      if (lengthResult.error) {
        return { expandedTargetIds: [], resolvedValues, error: lengthResult.error };
      }

      const directionResult = resolveDirection(
        expansion.direction,
        context,
        originTileId,
        `${key}.direction`,
      );

      if (directionResult.error) {
        return { expandedTargetIds: [], resolvedValues, error: directionResult.error };
      }

      Object.assign(resolvedValues, lengthResult.resolvedValues, directionResult.resolvedValues);
      const startId = selectedIds[0] ?? originTileId;

      if (expansion.includeOrigin ?? true) {
        expanded.add(startId);
      }

      for (const tileId of stepInDirection(
        startId,
        directionResult.direction,
        lengthResult.value,
      )) {
        if (context.world.tiles[tileId]) {
          expanded.add(tileId);
        }
      }

      resolvedValues[`${key}.linePath`] = [...expanded];
      break;
    }

    case "ring": {
      const radiusResult = resolveNumber(expansion.radius, context, `${key}.radius`, {
        minimum: 1,
        requirePositive: true,
      });

      if (radiusResult.error) {
        return { expandedTargetIds: [], resolvedValues, error: radiusResult.error };
      }

      Object.assign(resolvedValues, radiusResult.resolvedValues);
      const metric = expansion.metric ?? "manhattan";

      for (const selectedId of selectedIds) {
        const origin = parseTileId(selectedId);
        const coordinates = getCoordinatesWithinDistance(origin, radiusResult.value, {
          metric,
          includeOrigin: false,
        });

        for (const coordinate of coordinates) {
          const distance =
            metric === "manhattan"
              ? Math.abs(coordinate.x - origin.x) + Math.abs(coordinate.y - origin.y)
              : Math.max(
                  Math.abs(coordinate.x - origin.x),
                  Math.abs(coordinate.y - origin.y),
                );

          if (distance !== radiusResult.value) {
            continue;
          }

          const tileId = coordinateIds([coordinate])[0]!;

          if (context.world.tiles[tileId]) {
            expanded.add(tileId);
          }
        }
      }

      break;
    }

    case "connected-region": {
      for (const selectedId of selectedIds) {
        for (const tileId of getConnectedRegionTileIds(
          context.world,
          selectedId,
          expansion.match,
          expansion.connection ?? "cardinal",
        )) {
          expanded.add(tileId);
        }
      }

      break;
    }

    case "random-walk": {
      const stepsResult = resolveNumber(expansion.steps, context, `${key}.steps`, {
        minimum: 1,
        requirePositive: true,
      });

      if (stepsResult.error) {
        return { expandedTargetIds: [], resolvedValues, error: stepsResult.error };
      }

      Object.assign(resolvedValues, stepsResult.resolvedValues);
      const mode = expansion.mode ?? "cardinal";
      const random = createSeededRandom(`${context.randomSeed}:${key}:random-walk`);
      const walkPath: string[] = [];
      let currentId = selectedIds[0] ?? originTileId;
      walkPath.push(currentId);
      expanded.add(currentId);

      for (let step = 0; step < stepsResult.value; step++) {
        const neighbours = getExistingNeighbours(context.world, currentId, mode).map(
          (tile) => tile.id,
        );
        const pool = expansion.allowRevisit
          ? neighbours
          : neighbours.filter((tileId) => !walkPath.includes(tileId));

        if (pool.length === 0) {
          break;
        }

        const [nextId] = pickRandomItems(pool, 1, random);
        currentId = nextId!;
        walkPath.push(currentId);
        expanded.add(currentId);
      }

      resolvedValues[`${key}.randomWalkPath`] = walkPath;
      break;
    }

    default: {
      const unreachable: never = expansion;
      return {
        expandedTargetIds: [],
        resolvedValues,
        error: `Unsupported expansion: ${String(unreachable)}`,
      };
    }
  }

  if (expanded.size === 0 && selectedIds.length > 0) {
    for (const selectedId of selectedIds) {
      expanded.add(selectedId);
    }
  }

  return {
    expandedTargetIds: dedupeTileIds([...expanded]),
    resolvedValues,
  };
}
