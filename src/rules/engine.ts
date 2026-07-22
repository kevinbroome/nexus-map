import type { CardDefinition, ProposedAction } from "../cards/cardTypes";
import { createInvalidProposal } from "../cards/cardTypes";
import type { SelectionState } from "../selection/selectionTypes";
import {
  EndpointResolutionError,
  formatEndpointLabel,
  inferEndpointFromTile,
} from "../networks/endpoints";
import {
  applyTravelRoutesToWorld,
  buildRouteChanges,
  buildTravelRouteProposal,
  getCreateTravelRouteEffect,
} from "../networks/routeCreation";
import type { MapTile, TileChange, WorldState } from "../world/worldTypes";
import { cloneTile } from "../world/tileUtils";
import { applyWorldLaws } from "../worldLaws/applyWorldLaws";
import { formatConsequencePreviewMessages } from "../worldLaws/consequenceMessages";
import { evaluateConditions } from "./conditions";
import { applyEffectsToTile } from "./effects";
import { createRandomSeed } from "./random";
import { resolveCardTargets } from "./targets";

function buildTileChanges(
  world: WorldState,
  modifiedTiles: Record<string, MapTile>,
): TileChange[] {
  const changes: TileChange[] = [];

  for (const [tileId, after] of Object.entries(modifiedTiles)) {
    const before = world.tiles[tileId];

    if (!before) {
      continue;
    }

    changes.push({
      tileId,
      before: cloneTile(before),
      after: cloneTile(after),
    });
  }

  return changes;
}

function applyCardChanges(
  world: WorldState,
  cardChanges: TileChange[],
): WorldState {
  const tiles = Object.fromEntries(
    Object.entries(world.tiles).map(([tileId, tile]) => [tileId, cloneTile(tile)]),
  );

  for (const change of cardChanges) {
    tiles[change.tileId] = cloneTile(change.after);
  }

  return {
    ...world,
    tiles,
  };
}

function resolveRouteProposal(
  world: WorldState,
  card: CardDefinition,
  originTileId: string,
  destinationTileId: string,
  nextTurn: number,
) {
  const routeEffect = getCreateTravelRouteEffect(card.effects);

  if (!routeEffect) {
    return {
      ok: false as const,
      messages: ["This card does not define a travel route effect."],
    };
  }

  if (routeEffect.destination.type !== "selected-secondary-target") {
    return {
      ok: false as const,
      messages: [
        `Destination strategy "${routeEffect.destination.type}" is not implemented yet.`,
      ],
    };
  }

  const allowedNodeTypes =
    card.target.type === "two-endpoints"
      ? card.target.allowedNodeTypes
      : (["tile"] as const);

  const origin = inferEndpointFromTile(world, originTileId, [...allowedNodeTypes]);
  const destination = inferEndpointFromTile(
    world,
    destinationTileId,
    [...allowedNodeTypes],
  );

  if (!origin) {
    return {
      ok: false as const,
      messages: ["The selected origin is not a valid route endpoint."],
    };
  }

  if (!destination) {
    return {
      ok: false as const,
      messages: ["The selected destination is not a valid route endpoint."],
    };
  }

  try {
    const proposal = buildTravelRouteProposal(
      world,
      origin,
      destination,
      routeEffect,
      card.id,
      nextTurn,
    );

    if (proposal.validationMessages.length > 0) {
      return {
        ok: false as const,
        messages: proposal.validationMessages,
      };
    }

    return { ok: true as const, proposal };
  } catch (error) {
    const message =
      error instanceof EndpointResolutionError
        ? error.message
        : "The route endpoints could not be resolved.";

    return { ok: false as const, messages: [message] };
  }
}

export function proposeAction(
  world: WorldState,
  card: CardDefinition,
  selectionTileIds: string[],
  randomSeed: string = createRandomSeed(),
  selection?: SelectionState,
): ProposedAction {
  const targetResolution = resolveCardTargets(
    world,
    card.target,
    selectionTileIds,
    selection,
  );

  if (!targetResolution.ok) {
    return createInvalidProposal(
      card.id,
      [],
      targetResolution.messages,
      randomSeed,
    );
  }

  const targetIds = targetResolution.targetIds;
  const validationMessages: string[] = [];
  const modifiedTiles: Record<string, MapTile> = {};
  const resolvedValues: Record<string, unknown> = {};
  const routeEffect = getCreateTravelRouteEffect(card.effects);
  const nextTurn = world.turn + 1;

  let proposedRoutes: ProposedAction["proposedRoutes"] = [];
  let routeChanges: ProposedAction["routeChanges"] = [];

  if (routeEffect && card.target.type === "two-endpoints") {
    const [originTileId, destinationTileId] = targetIds;
    const routeResult = resolveRouteProposal(
      world,
      card,
      originTileId!,
      destinationTileId!,
      nextTurn,
    );

    if (!routeResult.ok) {
      return createInvalidProposal(
        card.id,
        targetIds,
        routeResult.messages,
        randomSeed,
      );
    }

    proposedRoutes = [routeResult.proposal];
    resolvedValues.route = {
      pathTileIds: routeResult.proposal.pathTileIds,
      totalCost: routeResult.proposal.totalCost,
      routeId: routeResult.proposal.route.id,
      origin: routeResult.proposal.route.origin,
      destination: routeResult.proposal.route.destination,
    };
    validationMessages.push(
      `Road path: ${routeResult.proposal.pathTileIds.length} tiles.`,
      `Travel cost: ${routeResult.proposal.totalCost}.`,
      `Origin: ${formatEndpointLabel(world, routeResult.proposal.route.origin)}`,
      `Destination: ${formatEndpointLabel(world, routeResult.proposal.route.destination)}`,
    );
  }

  for (const tileId of targetIds) {
    const tile = world.tiles[tileId];

    if (!tile) {
      validationMessages.push(`Tile "${tileId}" does not exist.`);
      continue;
    }

    const conditionResult = evaluateConditions(world, tile, card.conditions);

    if (!conditionResult.valid) {
      validationMessages.push(...conditionResult.messages);
      continue;
    }

    const nonRouteEffects = card.effects.filter(
      (effect) => effect.type !== "create-travel-route",
    );

    if (nonRouteEffects.length === 0) {
      continue;
    }

    try {
      Object.assign(
        modifiedTiles,
        applyEffectsToTile(
          world,
          tile,
          nonRouteEffects,
          randomSeed,
          resolvedValues,
        ),
      );
    } catch (error) {
      validationMessages.push(
        error instanceof Error ? error.message : "The card effect could not be applied.",
      );
    }
  }

  const cardChanges = buildTileChanges(world, modifiedTiles);
  const postCardWorld = applyCardChanges(world, cardChanges);
  const lawResult = applyWorldLaws(world, postCardWorld, nextTurn);

  let resultingWorld = lawResult.world;

  if (proposedRoutes.length > 0) {
    resultingWorld = applyTravelRoutesToWorld(
      resultingWorld,
      proposedRoutes.map((entry) => entry.route),
    );
    routeChanges = buildRouteChanges(world, proposedRoutes.map((entry) => entry.route));
  }

  const consequenceMessages = formatConsequencePreviewMessages(
    lawResult.consequences,
  );

  const hasRouteChanges = proposedRoutes.length > 0;
  const hasTileChanges = cardChanges.length > 0;

  if (!hasRouteChanges && !hasTileChanges) {
    return createInvalidProposal(
      card.id,
      targetIds,
      validationMessages.length > 0
        ? validationMessages
        : ["No valid targets were found for this card."],
      randomSeed,
    );
  }

  const successMessages: string[] = [];

  if (hasTileChanges) {
    successMessages.push(`${cardChanges.length} tile(s) will change.`);
  }

  if (hasRouteChanges) {
    successMessages.push("1 road will be created.");
  }

  return {
    cardId: card.id,
    targetIds,
    valid: true,
    validationMessages: [...validationMessages, ...successMessages, ...consequenceMessages],
    cardChanges,
    consequenceChanges: lawResult.tileChanges,
    regionChanges: lawResult.regionChanges,
    routeChanges,
    consequences: lawResult.consequences,
    proposedRoutes,
    nextTurn,
    resultingWorld,
    randomSeed,
    resolvedValues,
  };
}

export function getPreviewTileIds(proposal: ProposedAction): string[] {
  if (proposal.cardChanges.length > 0) {
    return proposal.cardChanges.map((change) => change.tileId);
  }

  return proposal.targetIds;
}

export function getConsequencePreviewTileIds(proposal: ProposedAction): string[] {
  return proposal.consequenceChanges.map((change) => change.tileId);
}

export function getRoutePreviewTileIds(proposal: ProposedAction): string[] {
  return proposal.proposedRoutes.flatMap((entry) => entry.pathTileIds);
}

export function formatProposalMessage(proposal: ProposedAction): string {
  return proposal.validationMessages.join("\n");
}

export function proposalsAreEqual(
  left: ProposedAction,
  right: ProposedAction,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function getAllPreviewTileIds(proposal: ProposedAction): string[] {
  return [
    ...new Set([
      ...getPreviewTileIds(proposal),
      ...getConsequencePreviewTileIds(proposal),
      ...getRoutePreviewTileIds(proposal),
    ]),
  ];
}

export function getRoutePreviewPath(proposal: ProposedAction): string[] {
  return proposal.proposedRoutes[0]?.pathTileIds ?? [];
}
