import { getRoutesThroughTile } from "../../networks/networkQueries";
import { findRegionForTileAtTier } from "../../worldLaws/settlementHierarchy";
import { getTileId, tileExists } from "../../world/coordinates";
import type { Coordinate } from "../../world/neighbours";
import type { MapTile, WorldState } from "../../world/worldTypes";
import { isRuinSettlement, isVillageSettlement } from "../../world/worldTypes";
import { distanceBetween } from "../targeting/utils";
import { resolveNumber } from "../targeting/numbers";
import { toTargetResolutionContext } from "./contextBridge";
import type {
  PropagationContext,
  PropagationStopDefinition,
} from "./types";

export function shouldStopBeforeEntering(
  world: WorldState,
  coordinate: Coordinate,
  tile: MapTile | undefined,
  stops: PropagationStopDefinition[],
  context: PropagationContext,
  seedTileId: string,
  accumulatedCost: number,
  affectedCount: number,
  resolvedValues: Record<string, unknown>,
): { blocked: boolean; reason?: string } {
  const tileId = tile?.id ?? getTileId(coordinate.x, coordinate.y);

  for (const stop of stops) {
    switch (stop.type) {
      case "terrain": {
        if (tile && stop.terrains.includes(tile.terrain)) {
          return {
            blocked: true,
            reason: `Blocked by ${tile.terrain} terrain.`,
          };
        }
        break;
      }

      case "tag": {
        if (tile && stop.tags.some((tag) => tile.tags.includes(tag))) {
          return {
            blocked: true,
            reason: `Blocked by tag on ${tileId}.`,
          };
        }
        break;
      }

      case "route": {
        if (!tile) {
          break;
        }

        const routes = getRoutesThroughTile(world, tile.id).filter((route) =>
          stop.routeType ? route.type === stop.routeType : true,
        );

        if (routes.length > 0) {
          return {
            blocked: true,
            reason: `Blocked by route on ${tileId}.`,
          };
        }

        break;
      }

      case "settlement-tier": {
        if (!tile) {
          break;
        }

        for (const tier of stop.tiers) {
          if (tier === "village" && isVillageSettlement(tile.settlement)) {
            return { blocked: true, reason: "Blocked by village settlement." };
          }

          if (tier === "ruin" && isRuinSettlement(tile.settlement)) {
            return { blocked: true, reason: "Blocked by ruin settlement." };
          }

          const region = findRegionForTileAtTier(
            world.settlementRegions,
            tile.id,
            tier as import("../../world/worldTypes").SettlementTier,
          );

          if (region) {
            return {
              blocked: true,
              reason: `Blocked by ${tier} settlement region.`,
            };
          }
        }

        break;
      }

      case "maximum-distance": {
        const distanceResult = resolveNumber(
          stop.distance,
          toTargetResolutionContext(context),
          "propagation.stop.maximumDistance",
          { minimum: 0 },
        );

        if (distanceResult.error) {
          return { blocked: true, reason: distanceResult.error };
        }

        Object.assign(resolvedValues, distanceResult.resolvedValues);

        const distance = distanceBetween(
          seedTileId,
          tileId,
          stop.metric ?? "manhattan",
        );

        if (distance > distanceResult.value) {
          return {
            blocked: true,
            reason: `Blocked by maximum distance ${distanceResult.value}.`,
          };
        }

        break;
      }

      case "maximum-cost":
        if (accumulatedCost > stop.cost) {
          return {
            blocked: true,
            reason: `Blocked by maximum cost ${stop.cost}.`,
          };
        }
        break;

      case "map-boundary":
        if (!tileExists(world, coordinate.x, coordinate.y)) {
          return {
            blocked: true,
            reason: "Blocked at map boundary.",
          };
        }
        break;

      case "after-count": {
        const countResult = resolveNumber(
          stop.count,
          toTargetResolutionContext(context),
          "propagation.stop.afterCount",
          { minimum: 1, requirePositive: true },
        );

        if (countResult.error) {
          return { blocked: true, reason: countResult.error };
        }

        Object.assign(resolvedValues, countResult.resolvedValues);

        if (affectedCount >= countResult.value) {
          return {
            blocked: true,
            reason: `Stopped after ${countResult.value} affected tiles.`,
          };
        }

        break;
      }

      default: {
        const unreachable: never = stop;
        return {
          blocked: true,
          reason: `Unsupported stop condition: ${String(unreachable)}`,
        };
      }
    }
  }

  return { blocked: false };
}
