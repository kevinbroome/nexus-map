import { inferEndpointFromTile } from "../../networks/endpoints";
import type { TravelEndpoint } from "../../networks/networkTypes";
import type { WorldState } from "../../world/worldTypes";
import { isVillageSettlement } from "../../world/worldTypes";
import { findRegionsContainingTile } from "../../worldLaws/settlementHierarchy";

export function inferTravelEndpointFromTile(
  world: WorldState,
  tileId: string,
): TravelEndpoint | null {
  const tile = world.tiles[tileId];

  if (!tile) {
    return null;
  }

  if (isVillageSettlement(tile.settlement)) {
    return inferEndpointFromTile(world, tileId, ["village"]);
  }

  const regions = findRegionsContainingTile(world.settlementRegions, tileId).sort(
    (left, right) => left.id.localeCompare(right.id),
  );

  if (regions.length > 0) {
    return inferEndpointFromTile(world, tileId, ["settlement-region"]);
  }

  return inferEndpointFromTile(world, tileId, ["tile"]);
}
