import type { WorldState } from "../world/worldTypes";
import type {
  RouteChange,
  TravelEndpoint,
  TravelRoute,
  TravelRouteType,
} from "./networkTypes";
import type { EffectDefinition as CardEffectDefinition } from "../cards/cardTypes";
import { createTravelRouteId } from "./routeId";
import { findTravelPath } from "./pathfinding";
import { validateTravelRoute } from "./routeValidation";
import type { ProposedTravelRoute } from "./networkTypes";

export type RouteEffectDefinition = Extract<
  CardEffectDefinition,
  { type: "create-travel-route" }
>;

export function buildTravelRouteProposal(
  world: WorldState,
  origin: TravelEndpoint,
  destination: TravelEndpoint,
  effect: RouteEffectDefinition,
  cardId: string,
  nextTurn: number,
): ProposedTravelRoute {
  const pathResult = findTravelPath(
    world,
    origin.tileId,
    destination.tileId,
    {
      routeType: effect.routeType,
      allowExistingRoutesBonus: effect.preferExistingNetwork ?? false,
    },
  );

  if (!pathResult.valid) {
    return {
      route: createPlaceholderRoute(origin, destination, effect.routeType, cardId, nextTurn),
      pathTileIds: [],
      totalCost: 0,
      validationMessages: [pathResult.reason ?? "No valid path exists."],
    };
  }

  const route: TravelRoute = {
    id: createTravelRouteId(
      effect.routeType,
      origin,
      destination,
      pathResult.pathTileIds,
    ),
    type: effect.routeType,
    origin,
    destination,
    pathTileIds: pathResult.pathTileIds,
    createdTurn: nextTurn,
    createdByCardId: cardId,
    tags: [],
    properties: {
      totalCost: pathResult.totalCost,
    },
  };

  const validationMessages = validateTravelRoute(world, route);

  return {
    route,
    pathTileIds: pathResult.pathTileIds,
    totalCost: pathResult.totalCost,
    validationMessages,
  };
}

function createPlaceholderRoute(
  origin: TravelEndpoint,
  destination: TravelEndpoint,
  routeType: TravelRouteType,
  cardId: string,
  nextTurn: number,
): TravelRoute {
  return {
    id: "invalid-route",
    type: routeType,
    origin,
    destination,
    pathTileIds: [],
    createdTurn: nextTurn,
    createdByCardId: cardId,
    tags: [],
    properties: {},
  };
}

export function applyTravelRoutesToWorld(
  world: WorldState,
  routes: TravelRoute[],
): WorldState {
  const travelRoutes = { ...world.travelRoutes };

  for (const route of routes) {
    travelRoutes[route.id] = route;
  }

  return {
    ...world,
    travelRoutes,
  };
}

export function buildRouteChanges(
  world: WorldState,
  routes: TravelRoute[],
): RouteChange[] {
  return routes.map((route) => ({
    type: "created" as const,
    routeId: route.id,
    before: world.travelRoutes[route.id],
    after: route,
  }));
}

export function isCreateTravelRouteEffect(
  effect: CardEffectDefinition,
): effect is RouteEffectDefinition {
  return effect.type === "create-travel-route";
}

export function getCreateTravelRouteEffect(
  effects: CardEffectDefinition[],
): RouteEffectDefinition | undefined {
  return effects.find(isCreateTravelRouteEffect);
}
