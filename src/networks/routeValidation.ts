import type { WorldState } from "../world/worldTypes";
import type { TravelRoute } from "./networkTypes";
import { endpointKey } from "./networkTypes";
import { areEndpointKeysDirectlyConnected } from "./settlementNetwork";
import { getTileTraversalCost } from "./travelCosts";
import { pathSegmentsAreCardinallyAdjacent } from "./settlementNetwork";

export function validateTravelRoute(
  world: WorldState,
  proposedRoute: TravelRoute,
): string[] {
  const errors: string[] = [];

  if (!world.tiles[proposedRoute.origin.tileId]) {
    errors.push("Route origin tile does not exist.");
  }

  if (!world.tiles[proposedRoute.destination.tileId]) {
    errors.push("Route destination tile does not exist.");
  }

  if (
    endpointKey(proposedRoute.origin) === endpointKey(proposedRoute.destination)
  ) {
    errors.push("Route endpoints must differ.");
  }

  if (proposedRoute.pathTileIds.length < 2) {
    errors.push("Route path must contain at least two tiles.");
  }

  if (proposedRoute.pathTileIds[0] !== proposedRoute.origin.tileId) {
    errors.push("Route path must start at the origin tile.");
  }

  if (
    proposedRoute.pathTileIds.at(-1) !== proposedRoute.destination.tileId
  ) {
    errors.push("Route path must end at the destination tile.");
  }

  for (const tileId of proposedRoute.pathTileIds) {
    if (!world.tiles[tileId]) {
      errors.push(`Route path tile "${tileId}" does not exist.`);
    }
  }

  if (!pathSegmentsAreCardinallyAdjacent(world, proposedRoute.pathTileIds)) {
    errors.push("Every consecutive route tile must be cardinally adjacent.");
  }

  const seenTiles = new Set<string>();

  for (const tileId of proposedRoute.pathTileIds) {
    if (seenTiles.has(tileId)) {
      errors.push(`Route path repeats tile "${tileId}".`);
    }

    seenTiles.add(tileId);
  }

  for (const tileId of proposedRoute.pathTileIds) {
    const cost = getTileTraversalCost(world, tileId, {
      routeType: proposedRoute.type,
    });

    if (!Number.isFinite(cost)) {
      errors.push(`Route path crosses impassable terrain at "${tileId}".`);
    }
  }

  if (world.travelRoutes[proposedRoute.id]) {
    errors.push(`Route "${proposedRoute.id}" already exists.`);
  }

  const originKey = endpointKey(proposedRoute.origin);
  const destinationKey = endpointKey(proposedRoute.destination);

  if (
    areEndpointKeysDirectlyConnected(
      world,
      originKey,
      destinationKey,
      proposedRoute.type,
    )
  ) {
    errors.push("An equivalent route already connects these endpoints.");
  }

  return errors;
}
