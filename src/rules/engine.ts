import type { CardDefinition, ProposedAction } from "../cards/cardTypes";
import { createInvalidProposal, toPropagationRecord, toTargetResolutionRecord } from "../cards/cardTypes";
import { evaluatePlayRequirements } from "../cards/playRequirements";
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
import { applyEffectsToTile, applyEmptyUrbanRegionEffect } from "./effects";
import {
  getPropagatingEffects,
  propagateEffect,
} from "./propagation/propagate";
import { propagationNeedsSeedFallback } from "./propagation/seedFallback";
import { describePropagationResult } from "./propagation/describe";
import { createRandomSeed } from "./random";
import { getRouteEndpointTileIds } from "./targeting/resolveTargets";
import { resolveCardTargets } from "./targets";

function buildTileChanges(
  world: WorldState,
  modifiedTiles: Record<string, MapTile>,
  explicitChanges: TileChange[] = [],
): TileChange[] {
  const changes = [...explicitChanges];

  for (const [tileId, after] of Object.entries(modifiedTiles)) {
    const before = world.tiles[tileId];

    if (before && JSON.stringify(before) === JSON.stringify(after)) {
      continue;
    }

    changes.push({
      tileId,
      before: before ? cloneTile(before) : null,
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

function isDirectEffect(
  effect: CardDefinition["effects"][number],
): boolean {
  return (
    effect.type !== "create-travel-route" &&
    effect.type !== "propagate" &&
    effect.type !== "empty-urban-region"
  );
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

  const allowedNodeTypes = routeEffect.allowedNodeTypes ?? (["tile"] as const);
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
  const playCheck = evaluatePlayRequirements(world, card.playRequirements);

  if (!playCheck.playable) {
    return createInvalidProposal(
      card.id,
      selectionTileIds,
      playCheck.messages,
      randomSeed,
    );
  }

  const previousAction = world.history.at(-1);
  const targetResolution = resolveCardTargets(
    world,
    card,
    selectionTileIds,
    selection,
    randomSeed,
    previousAction,
  );

  if (!targetResolution.ok || !targetResolution.result) {
    return createInvalidProposal(
      card.id,
      [],
      targetResolution.ok ? ["Target resolution failed."] : targetResolution.messages,
      randomSeed,
      targetResolution.result,
    );
  }

  const resolution = targetResolution.result;
  const targetIds = targetResolution.targetIds;
  const validationMessages: string[] = [];
  const modifiedTiles: Record<string, MapTile> = {};
  const resolvedValues: Record<string, unknown> = {
    ...resolution.resolvedValues,
  };
  const routeEffect = getCreateTravelRouteEffect(card.effects);
  const nextTurn = world.turn + 1;

  let proposedRoutes: ProposedAction["proposedRoutes"] = [];
  let routeChanges: ProposedAction["routeChanges"] = [];

  if (routeEffect) {
    const [originTileId, destinationTileId] = getRouteEndpointTileIds(resolution);

    if (!originTileId || !destinationTileId) {
      return createInvalidProposal(
        card.id,
        targetIds,
        ["Route endpoints could not be resolved."],
        randomSeed,
        resolution,
      );
    }

    const routeResult = resolveRouteProposal(
      world,
      card,
      originTileId,
      destinationTileId,
      nextTurn,
    );

    if (!routeResult.ok) {
      return createInvalidProposal(
        card.id,
        targetIds,
        routeResult.messages,
        randomSeed,
        resolution,
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

  const effectTargetIds = routeEffect
    ? resolution.expandedTargetIds
    : targetIds;
  const propagationEffects = getPropagatingEffects(card.effects);
  const propagationResults: ProposedAction["propagationResults"] = [];
  const propagationChanges: TileChange[] = [];

  if (propagationEffects.length > 0) {
    const seedTileIds = resolution.expandedTargetIds.filter((tileId) => {
      const tile = world.tiles[tileId];

      if (!tile) {
        validationMessages.push(`Propagation seed "${tileId}" does not exist.`);
        return false;
      }

      const conditionResult = evaluateConditions(world, tile, card.conditions);

      if (!conditionResult.valid) {
        validationMessages.push(...conditionResult.messages);
        return false;
      }

      return true;
    });

    card.effects.forEach((effect, effectIndex) => {
      if (effect.type !== "propagate") {
        return;
      }

      const result = propagateEffect(effect, {
        world,
        card,
        seedTileIds,
        randomSeed,
        resolvedTargetValues: resolvedValues,
        previousAction,
        effectIndex,
      });

      propagationResults.push(result);
      Object.assign(resolvedValues, result.resolvedValues);
      propagationChanges.push(...result.tileChanges);

      if (!result.valid) {
        validationMessages.push(...result.validationMessages);
      } else {
        validationMessages.push(...describePropagationResult(result));
      }
    });

    if (
      propagationResults.some((result) => !result.valid) ||
      (seedTileIds.length === 0 &&
        !propagationEffects.some(
          (effect) =>
            effect.seedFallback &&
            (effect.seedFallback.whenMissingTerrain
              ? propagationNeedsSeedFallback(
                  world,
                  effect.seedFallback.whenMissingTerrain,
                )
              : effect.operation.type === "set-terrain" &&
                propagationNeedsSeedFallback(world, effect.operation.terrain)),
        ))
    ) {
      return createInvalidProposal(
        card.id,
        targetIds,
        validationMessages.length > 0
          ? validationMessages
          : ["Propagation could not be resolved."],
        randomSeed,
        resolution,
      );
    }
  }

  for (const tileId of effectTargetIds) {
    const tile = world.tiles[tileId];

    if (!tile) {
      if (propagationEffects.length === 0) {
        validationMessages.push(`Tile "${tileId}" does not exist.`);
      }

      continue;
    }

    const conditionResult = evaluateConditions(world, tile, card.conditions);

    if (!conditionResult.valid) {
      validationMessages.push(...conditionResult.messages);
      continue;
    }

    for (const effect of card.effects) {
      if (effect.type === "empty-urban-region") {
        Object.assign(
          modifiedTiles,
          applyEmptyUrbanRegionEffect(
            world,
            tileId,
            effect,
            randomSeed,
            resolvedValues,
          ),
        );
      }
    }

    const directEffects = card.effects.filter(isDirectEffect);

    if (directEffects.length === 0) {
      continue;
    }

    try {
      Object.assign(
        modifiedTiles,
        applyEffectsToTile(
          world,
          tile,
          directEffects,
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

  const cardChanges = buildTileChanges(world, modifiedTiles, propagationChanges);
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
      resolution,
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
    targetResolution: resolution,
    propagationResults,
    nextTurn,
    resultingWorld,
    randomSeed,
    resolvedValues,
  };
}

export function getPreviewTileIds(proposal: ProposedAction): string[] {
  const propagatedIds = proposal.propagationResults.flatMap((result) => [
    ...result.affectedTileIds,
    ...result.createdTileIds,
  ]);

  if (propagatedIds.length > 0) {
    return [...new Set(propagatedIds)];
  }

  if (proposal.targetResolution?.expandedTargetIds.length) {
    return proposal.targetResolution.expandedTargetIds;
  }

  if (proposal.cardChanges.length > 0) {
    return proposal.cardChanges.map((change) => change.tileId);
  }

  return proposal.targetIds;
}

export function getPropagationPreviewTileIds(
  proposal: ProposedAction,
): string[] {
  return [
    ...new Set(
      proposal.propagationResults.flatMap((result) => [
        ...result.seedTileIds,
        ...result.affectedTileIds,
        ...result.createdTileIds,
      ]),
    ),
  ];
}

export function getPropagationSeedTileIds(proposal: ProposedAction): string[] {
  return [
    ...new Set(
      proposal.propagationResults.flatMap((result) => result.seedTileIds),
    ),
  ];
}

export function getPropagationAffectedTileIds(
  proposal: ProposedAction,
): string[] {
  return [
    ...new Set(
      proposal.propagationResults.flatMap((result) => result.affectedTileIds),
    ),
  ];
}

export function getPropagationCreatedTileIds(
  proposal: ProposedAction,
): string[] {
  return [
    ...new Set(
      proposal.propagationResults.flatMap((result) => result.createdTileIds),
    ),
  ];
}

export function getPropagationBlockedTileIds(
  proposal: ProposedAction,
): string[] {
  return [
    ...new Set(
      proposal.propagationResults.flatMap((result) => result.blockedTileIds),
    ),
  ];
}

export function getPropagationTraversedTileIds(
  proposal: ProposedAction,
): string[] {
  return [
    ...new Set(
      proposal.propagationResults.flatMap((result) => result.traversedTileIds),
    ),
  ];
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
      ...getPropagationPreviewTileIds(proposal),
      ...getPropagationBlockedTileIds(proposal),
      ...getConsequencePreviewTileIds(proposal),
      ...getRoutePreviewTileIds(proposal),
    ]),
  ];
}

export function getPropagationRecords(proposal: ProposedAction) {
  return proposal.propagationResults.map((result, effectIndex) =>
    toPropagationRecord(result, effectIndex),
  );
}

export function getRoutePreviewPath(proposal: ProposedAction): string[] {
  return proposal.proposedRoutes[0]?.pathTileIds ?? [];
}

export function getTargetResolutionRecord(proposal: ProposedAction) {
  return proposal.targetResolution
    ? toTargetResolutionRecord(proposal.targetResolution)
    : null;
}
