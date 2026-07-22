import type { WorldState } from "../world/worldTypes";
import { isVillageSettlement } from "../world/worldTypes";
import { findRegionsContainingTile } from "../worldLaws/settlementHierarchy";
import type { TravelEndpoint, TravelNodeType } from "./networkTypes";

export class EndpointResolutionError extends Error {}

export function resolveTravelEndpoint(
  world: WorldState,
  type: TravelNodeType,
  id: string,
): TravelEndpoint {
  switch (type) {
    case "tile": {
      const tile = world.tiles[id];

      if (!tile) {
        throw new EndpointResolutionError(`Tile "${id}" does not exist.`);
      }

      return { type: "tile", id, tileId: id };
    }

    case "village": {
      const tile = world.tiles[id];

      if (!tile) {
        throw new EndpointResolutionError(`Village tile "${id}" does not exist.`);
      }

      if (!isVillageSettlement(tile.settlement)) {
        throw new EndpointResolutionError(
          `Tile "${id}" does not contain an active village.`,
        );
      }

      return { type: "village", id, tileId: id };
    }

    case "settlement-region": {
      const region = world.settlementRegions[id];

      if (!region) {
        throw new EndpointResolutionError(
          `Settlement region "${id}" does not exist.`,
        );
      }

      const anchorTile = world.tiles[region.anchorTileId];

      if (!anchorTile) {
        throw new EndpointResolutionError(
          `Settlement region "${id}" anchor tile is missing.`,
        );
      }

      return {
        type: "settlement-region",
        id,
        tileId: region.anchorTileId,
      };
    }

    default: {
      const unreachable: never = type;
      throw new EndpointResolutionError(`Unsupported endpoint type: ${String(unreachable)}`);
    }
  }
}

export function inferEndpointFromTile(
  world: WorldState,
  tileId: string,
  allowedNodeTypes: TravelNodeType[],
): TravelEndpoint | null {
  const tile = world.tiles[tileId];

  if (!tile) {
    return null;
  }

  if (allowedNodeTypes.includes("village") && isVillageSettlement(tile.settlement)) {
    return resolveTravelEndpoint(world, "village", tileId);
  }

  if (allowedNodeTypes.includes("settlement-region")) {
    const regions = findRegionsContainingTile(world.settlementRegions, tileId).sort(
      (left, right) => left.id.localeCompare(right.id),
    );

    if (regions.length > 0) {
      return resolveTravelEndpoint(world, "settlement-region", regions[0]!.id);
    }
  }

  if (allowedNodeTypes.includes("tile")) {
    return resolveTravelEndpoint(world, "tile", tileId);
  }

  return null;
}

export function formatEndpointLabel(
  world: WorldState,
  endpoint: TravelEndpoint,
): string {
  const tile = world.tiles[endpoint.tileId];

  switch (endpoint.type) {
    case "tile":
      return tile ? `Tile ${tile.x},${tile.y}` : `Tile ${endpoint.tileId}`;

    case "village":
      return tile ? `Village ${tile.x},${tile.y}` : `Village ${endpoint.id}`;

    case "settlement-region": {
      const region = world.settlementRegions[endpoint.id];
      const tier = region?.tier ?? "settlement";
      return `${tier} ${endpoint.id}`;
    }

    default:
      return endpoint.id;
  }
}
