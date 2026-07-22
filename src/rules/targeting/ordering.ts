import { getTileTraversalCost } from "../../networks/travelCosts";
import type { TargetOrderingDefinition, TargetResolutionContext } from "./types";
import { compareTileIds, distanceBetween, sortTileIds } from "./utils";
import { getRegionTierRank } from "./regionMatch";
import { createSeededRandom } from "../random";
import { pickRandomItems } from "../random";

export function applyOrdering(
  world: TargetResolutionContext["world"],
  candidateIds: string[],
  ordering: TargetOrderingDefinition | undefined,
  context: TargetResolutionContext,
  originTileId: string,
  key = "ordering",
): { orderedIds: string[]; resolvedValues: Record<string, unknown> } {
  if (!ordering || ordering.type === "coordinate") {
    return { orderedIds: sortTileIds(candidateIds), resolvedValues: {} };
  }

  const resolvedValues: Record<string, unknown> = {};
  const sorted = [...candidateIds];

  switch (ordering.type) {
    case "nearest-to-origin":
      sorted.sort((left, right) => {
        const leftDistance = distanceBetween(left, originTileId, "manhattan");
        const rightDistance = distanceBetween(right, originTileId, "manhattan");

        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance;
        }

        return compareTileIds(left, right);
      });
      return { orderedIds: sorted, resolvedValues };

    case "farthest-from-origin":
      sorted.sort((left, right) => {
        const leftDistance = distanceBetween(left, originTileId, "manhattan");
        const rightDistance = distanceBetween(right, originTileId, "manhattan");

        if (leftDistance !== rightDistance) {
          return rightDistance - leftDistance;
        }

        return compareTileIds(left, right);
      });
      return { orderedIds: sorted, resolvedValues };

    case "lowest-terrain-cost":
      sorted.sort((left, right) => {
        const leftCost = getTileTraversalCost(world, left, {
          routeType: ordering.routeType ?? "road",
        });
        const rightCost = getTileTraversalCost(world, right, {
          routeType: ordering.routeType ?? "road",
        });

        if (leftCost !== rightCost) {
          return leftCost - rightCost;
        }

        return compareTileIds(left, right);
      });
      return { orderedIds: sorted, resolvedValues };

    case "highest-settlement-tier":
      sorted.sort((left, right) => {
        const leftRank = getRegionTierRank(world, left);
        const rightRank = getRegionTierRank(world, right);

        if (leftRank !== rightRank) {
          return rightRank - leftRank;
        }

        return compareTileIds(left, right);
      });
      return { orderedIds: sorted, resolvedValues };

    case "lowest-settlement-tier":
      sorted.sort((left, right) => {
        const leftRank = getRegionTierRank(world, left);
        const rightRank = getRegionTierRank(world, right);

        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        return compareTileIds(left, right);
      });
      return { orderedIds: sorted, resolvedValues };

    case "random": {
      const random = createSeededRandom(`${context.randomSeed}:${key}:random-order`);
      const orderedIds = pickRandomItems(sortTileIds(candidateIds), candidateIds.length, random);
      resolvedValues[`${key}.randomOrder`] = orderedIds;
      return { orderedIds, resolvedValues };
    }

    default: {
      const unreachable: never = ordering;
      throw new Error(`Unsupported ordering: ${String(unreachable)}`);
    }
  }
}
