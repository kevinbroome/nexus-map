import { getTileId, tileExists } from "../../world/coordinates";
import { getExistingTiles } from "../../world/coordinates";
import { isBoundaryTile } from "../../world/tileCreation";
import { findNearestSettlementEndpoint, getWorldCentreTileId } from "./directions";
import { findRegionsContainingTile } from "../../worldLaws/settlementHierarchy";
import type {
  TargetOriginDefinition,
  TargetResolutionContext,
} from "./types";
import { createSeededRandom, pickRandomItems } from "../random";
import { sortTileIds } from "./utils";

export type OriginResolution = {
  tileIds: string[];
  resolvedValues: Record<string, unknown>;
  error?: string;
};

export function resolveOrigin(
  definition: TargetOriginDefinition,
  context: TargetResolutionContext,
  key = "origin",
): OriginResolution {
  const resolvedValues: Record<string, unknown> = {};

  switch (definition.type) {
    case "primary-selection": {
      if (!context.primarySelectionId) {
        return {
          tileIds: [],
          resolvedValues,
          error: "Select a primary target first.",
        };
      }

      resolvedValues[`${key}.primarySelection`] = context.primarySelectionId;
      return { tileIds: [context.primarySelectionId], resolvedValues };
    }

    case "secondary-selection": {
      if (!context.secondarySelectionId) {
        return {
          tileIds: [],
          resolvedValues,
          error: "Select a secondary target first.",
        };
      }

      resolvedValues[`${key}.secondarySelection`] = context.secondarySelectionId;
      return { tileIds: [context.secondarySelectionId], resolvedValues };
    }

    case "previously-affected-tile": {
      const tileId = context.currentActionTargetIds?.[0];

      if (!tileId) {
        return {
          tileIds: [],
          resolvedValues,
          error: "No previously affected tile is available in this action.",
        };
      }

      resolvedValues[`${key}.previouslyAffectedTile`] = tileId;
      return { tileIds: [tileId], resolvedValues };
    }

    case "previous-action-target": {
      const previousTargets =
        context.previousAction?.targetResolution?.expandedTargetIds ??
        context.previousAction?.targetIds ??
        [];

      if (previousTargets.length === 0) {
        return {
          tileIds: [],
          resolvedValues,
          error: "No previous action target is available.",
        };
      }

      resolvedValues[`${key}.previousActionTarget`] = previousTargets[0];
      return { tileIds: [previousTargets[0]!], resolvedValues };
    }

    case "random-existing-tile": {
      const tiles = sortTileIds(
        getExistingTiles(context.world).map((tile) => tile.id),
      );

      if (tiles.length === 0) {
        return {
          tileIds: [],
          resolvedValues,
          error: "No existing tiles are available for random selection.",
        };
      }

      const random = createSeededRandom(`${context.randomSeed}:${key}:random-existing`);
      const [picked] = pickRandomItems(tiles, 1, random);
      resolvedValues[`${key}.randomExistingTile`] = picked;
      return { tileIds: [picked!], resolvedValues };
    }

    case "random-boundary-tile": {
      const boundaryTiles = sortTileIds(
        getExistingTiles(context.world)
          .filter((tile) => isBoundaryTile(context.world, tile.id))
          .map((tile) => tile.id),
      );

      if (boundaryTiles.length === 0) {
        return {
          tileIds: [],
          resolvedValues,
          error: "No boundary tiles are available for random selection.",
        };
      }

      const random = createSeededRandom(`${context.randomSeed}:${key}:random-boundary`);
      const [picked] = pickRandomItems(boundaryTiles, 1, random);
      resolvedValues[`${key}.randomBoundaryTile`] = picked;
      return { tileIds: [picked!], resolvedValues };
    }

    case "world-centre": {
      const tileId = getWorldCentreTileId(context.world);
      resolvedValues[`${key}.worldCentre`] = tileId;
      return { tileIds: [tileId], resolvedValues };
    }

    case "nearest-settlement": {
      const originId =
        context.primarySelectionId ?? getWorldCentreTileId(context.world);
      const nearest = findNearestSettlementEndpoint(context.world, originId, {
        excludeOrigin: true,
      });

      if (!nearest) {
        return {
          tileIds: [],
          resolvedValues,
          error: "No settlement exists to resolve as origin.",
        };
      }

      if (definition.settlementTier) {
        const tile = context.world.tiles[nearest];

        if (definition.settlementTier === "village") {
          if (tile?.settlement?.type !== "village") {
            return {
              tileIds: [],
              resolvedValues,
              error: "Nearest settlement is not a village.",
            };
          }
        } else {
          const regions = findRegionsContainingTile(
            context.world.settlementRegions,
            nearest,
          ).filter((region) => region.tier === definition.settlementTier);

          if (regions.length === 0) {
            return {
              tileIds: [],
              resolvedValues,
              error: `Nearest settlement does not match tier "${definition.settlementTier}".`,
            };
          }
        }
      }

      resolvedValues[`${key}.nearestSettlement`] = nearest;
      return { tileIds: [nearest], resolvedValues };
    }

    case "specific-coordinate": {
      const tileId = getTileId(definition.x, definition.y);

      if (!tileExists(context.world, definition.x, definition.y)) {
        return {
          tileIds: [tileId],
          resolvedValues: {
            ...resolvedValues,
            [`${key}.specificCoordinate`]: tileId,
            [`${key}.missing`]: true,
          },
        };
      }

      resolvedValues[`${key}.specificCoordinate`] = tileId;
      return { tileIds: [tileId], resolvedValues };
    }

    default: {
      const unreachable: never = definition;
      return {
        tileIds: [],
        resolvedValues,
        error: `Unsupported origin definition: ${String(unreachable)}`,
      };
    }
  }
}
