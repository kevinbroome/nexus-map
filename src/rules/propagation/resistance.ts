import { getRoutesThroughTile } from "../../networks/networkQueries";
import { findRegionForTileAtTier } from "../../worldLaws/settlementHierarchy";
import type { MapTile, WorldState } from "../../world/worldTypes";
import { isRuinSettlement, isVillageSettlement } from "../../world/worldTypes";
import type { ResistanceDefinition } from "./types";

export function calculateResistance(
  world: WorldState,
  tile: MapTile,
  definitions: ResistanceDefinition[] = [],
): number {
  let total = 0;

  for (const definition of definitions) {
    switch (definition.type) {
      case "terrain":
        if (tile.terrain === definition.terrain) {
          total += definition.resistance;
        }
        break;

      case "tag":
        if (tile.tags.includes(definition.tag)) {
          total += definition.resistance;
        }
        break;

      case "settlement-tier": {
        if (definition.tier === "village" && isVillageSettlement(tile.settlement)) {
          total += definition.resistance;
          break;
        }

        if (definition.tier === "ruin" && isRuinSettlement(tile.settlement)) {
          total += definition.resistance;
          break;
        }

        const region = findRegionForTileAtTier(
          world.settlementRegions,
          tile.id,
          definition.tier as import("../../world/worldTypes").SettlementTier,
        );

        if (region) {
          total += definition.resistance;
        }

        break;
      }

      case "route": {
        const routes = getRoutesThroughTile(world, tile.id).filter((route) =>
          definition.routeType ? route.type === definition.routeType : true,
        );

        if (routes.length > 0) {
          total += definition.resistance;
        }

        break;
      }

      case "property": {
        const value = tile.properties[definition.property];

        if (typeof value !== "number") {
          break;
        }

        if (definition.minimum !== undefined && value < definition.minimum) {
          break;
        }

        if (definition.maximum !== undefined && value > definition.maximum) {
          break;
        }

        total += definition.resistance;
        break;
      }

      default: {
        const unreachable: never = definition;
        throw new Error(`Unsupported resistance: ${String(unreachable)}`);
      }
    }
  }

  return total;
}

export function isResistanceBlocking(resistance: number): boolean {
  return !Number.isFinite(resistance) || resistance === Number.POSITIVE_INFINITY;
}
