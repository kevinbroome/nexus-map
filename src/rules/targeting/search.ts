import { getCoordinatesWithinDistance } from "../../world/neighbours";
import { getExistingTiles } from "../../world/coordinates";
import { parseTileId } from "../../world/coordinates";
import { getExistingNeighbours } from "../../world/neighbours";
import { isBoundaryTile } from "../../world/tileCreation";
import { getAllRoutes } from "../../networks/networkQueries";
import { resolveDirection, stepInDirection, findNearestSettlementEndpoint } from "./directions";
import { getConnectedRegionTileIds, getRoadNetworkTileIds } from "./regionMatch";
import { resolveNumber } from "./numbers";
import type {
  TargetResolutionContext,
  TargetSearchDefinition,
} from "./types";
import { coordinateIds, dedupeTileIds, sortTileIds } from "./utils";

export type SearchResolution = {
  candidateIds: string[];
  resolvedValues: Record<string, unknown>;
  error?: string;
};

export function applySearch(
  definition: TargetSearchDefinition,
  context: TargetResolutionContext,
  originIds: string[],
  key = "search",
): SearchResolution {
  if (originIds.length === 0) {
    return {
      candidateIds: [],
      resolvedValues: {},
      error: "Search requires at least one origin tile.",
    };
  }

  const primaryOrigin = originIds[0]!;
  const resolvedValues: Record<string, unknown> = {};

  switch (definition.type) {
    case "origin-only":
      return { candidateIds: sortTileIds(originIds), resolvedValues };

    case "adjacent": {
      const mode = definition.mode ?? "cardinal";
      const neighbours = getExistingNeighbours(
        context.world,
        primaryOrigin,
        mode,
      ).map((tile) => tile.id);
      return {
        candidateIds: dedupeTileIds([...originIds, ...neighbours]),
        resolvedValues,
      };
    }

    case "within-distance": {
      const distanceResult = resolveNumber(
        definition.distance,
        context,
        `${key}.distance`,
        { minimum: 0 },
      );

      if (distanceResult.error) {
        return { candidateIds: [], resolvedValues, error: distanceResult.error };
      }

      Object.assign(resolvedValues, distanceResult.resolvedValues);
      const origin = parseTileId(primaryOrigin);
      const coordinates = getCoordinatesWithinDistance(
        origin,
        distanceResult.value,
        {
          metric: definition.metric ?? "manhattan",
          includeOrigin: definition.includeOrigin ?? false,
        },
      );
      const candidateIds = coordinateIds(coordinates).filter(
        (tileId) => context.world.tiles[tileId] !== undefined,
      );

      if (definition.includeOrigin) {
        candidateIds.unshift(primaryOrigin);
      }

      return {
        candidateIds: dedupeTileIds(
          definition.includeOrigin ? [...originIds, ...candidateIds] : candidateIds,
        ),
        resolvedValues,
      };
    }

    case "exact-distance": {
      const distanceResult = resolveNumber(
        definition.distance,
        context,
        `${key}.distance`,
        { minimum: 0 },
      );

      if (distanceResult.error) {
        return { candidateIds: [], resolvedValues, error: distanceResult.error };
      }

      Object.assign(resolvedValues, distanceResult.resolvedValues);
      const metric = definition.metric ?? "manhattan";
      const origin = parseTileId(primaryOrigin);
      const allCoordinates = getCoordinatesWithinDistance(
        origin,
        distanceResult.value,
        { metric, includeOrigin: false },
      );
      const candidateIds = coordinateIds(allCoordinates).filter((tileId) => {
        if (!context.world.tiles[tileId]) {
          return false;
        }

        const distance =
          metric === "manhattan"
            ? Math.abs(parseTileId(tileId).x - origin.x) +
              Math.abs(parseTileId(tileId).y - origin.y)
            : Math.max(
                Math.abs(parseTileId(tileId).x - origin.x),
                Math.abs(parseTileId(tileId).y - origin.y),
              );
        return distance === distanceResult.value;
      });

      return { candidateIds: sortTileIds(candidateIds), resolvedValues };
    }

    case "direction": {
      const distanceResult = resolveNumber(
        definition.distance,
        context,
        `${key}.distance`,
        { minimum: 1, requirePositive: true },
      );

      if (distanceResult.error) {
        return { candidateIds: [], resolvedValues, error: distanceResult.error };
      }

      const directionResult = resolveDirection(
        definition.direction,
        context,
        primaryOrigin,
        `${key}.direction`,
      );

      if (directionResult.error) {
        return { candidateIds: [], resolvedValues, error: directionResult.error };
      }

      Object.assign(resolvedValues, distanceResult.resolvedValues, directionResult.resolvedValues);
      const path = stepInDirection(
        primaryOrigin,
        directionResult.direction,
        distanceResult.value,
      );

      return {
        candidateIds: sortTileIds(path),
        resolvedValues,
      };
    }

    case "connected-region": {
      const region = getConnectedRegionTileIds(
        context.world,
        primaryOrigin,
        definition.match,
        definition.connection ?? "cardinal",
      );

      if (region.length === 0) {
        return {
          candidateIds: [],
          resolvedValues,
          error: "No connected region matches from the origin.",
        };
      }

      resolvedValues[`${key}.connectedRegionSize`] = region.length;
      return { candidateIds: sortTileIds(region), resolvedValues };
    }

    case "nearest": {
      const nearest = findNearestSettlementEndpoint(context.world, primaryOrigin, {
        excludeOrigin: true,
        maximumDistance: definition.maximumDistance,
      });

      if (!nearest) {
        return {
          candidateIds: [],
          resolvedValues,
          error: "No nearest target was found.",
        };
      }

      resolvedValues[`${key}.nearest`] = nearest;
      return { candidateIds: [nearest], resolvedValues };
    }

    case "map-boundary": {
      const boundaryIds = sortTileIds(
        getExistingTiles(context.world)
          .filter((tile) => isBoundaryTile(context.world, tile.id))
          .map((tile) => tile.id),
      );

      if (boundaryIds.length === 0) {
        return {
          candidateIds: [],
          resolvedValues,
          error: "No boundary tiles exist.",
        };
      }

      return { candidateIds: boundaryIds, resolvedValues };
    }

    case "along-route": {
      const stepsResult = definition.maximumSteps
        ? resolveNumber(definition.maximumSteps, context, `${key}.maximumSteps`, {
            minimum: 0,
          })
        : { value: Number.POSITIVE_INFINITY, resolvedValues: {} };

      if (stepsResult.error) {
        return { candidateIds: [], resolvedValues, error: stepsResult.error };
      }

      Object.assign(resolvedValues, stepsResult.resolvedValues);
      const routeType = definition.routeType ?? "road";
      const networkTiles = getRoadNetworkTileIds(
        context.world,
        primaryOrigin,
        routeType,
      );
      const routes = getAllRoutes(context.world).filter((route) => {
        if (route.type !== routeType) {
          return false;
        }

        return route.pathTileIds.includes(primaryOrigin);
      });

      const candidateIds = new Set<string>(networkTiles);

      for (const route of routes) {
        const originIndex = route.pathTileIds.indexOf(primaryOrigin);

        for (let offset = 0; offset <= stepsResult.value; offset++) {
          const forward = route.pathTileIds[originIndex + offset];
          const backward = route.pathTileIds[originIndex - offset];

          if (forward) {
            candidateIds.add(forward);
          }

          if (backward) {
            candidateIds.add(backward);
          }
        }
      }

      return {
        candidateIds: sortTileIds([...candidateIds]),
        resolvedValues,
      };
    }

    default: {
      const unreachable: never = definition;
      return {
        candidateIds: [],
        resolvedValues,
        error: `Unsupported search definition: ${String(unreachable)}`,
      };
    }
  }
}
