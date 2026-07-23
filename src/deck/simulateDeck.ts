import type { CardDefinition } from "../cards/cardTypes";
import { toPropagationRecord, toTargetResolutionRecord } from "../cards/cardTypes";
import { cloneDeckState } from "./deckTypes";
import { discardActiveCard, drawCard } from "./deckOperations";
import { getActiveInstance, getCardDefinition } from "./deckQueries";
import { buildSimulationSelectionTileIds } from "../rules/failure/autoTarget";
import {
  canCommitProposal,
  proposeCardPlay,
} from "../rules/proposeCardPlay";
import type { WorldAction, WorldState } from "../world/worldTypes";

export interface SimulationMetrics {
  turnsCompleted: number;
  successfulPlays: number;
  discardedPlays: number;
  failedPlays: number;
  tilesCreated: number;
  routesCreated: number;
  deckMutationsApplied: number;
  maxPropagationSteps: number;
  shuffleCount: number;
}

export interface SimulationResult {
  finalWorld: WorldState;
  metrics: SimulationMetrics;
  history: WorldAction[];
  stoppedReason: "completed" | "empty-deck" | "max-turns" | "stalled";
}

function buildShuffleSeed(world: WorldState): string {
  const latestActionId = world.history.at(-1)?.id ?? "sim-start";
  return `${world.id}:${world.deck.shuffleCount}:${latestActionId}`;
}

function applyProposalInMemory(
  world: WorldState,
  proposal: ReturnType<typeof proposeCardPlay>,
  card: CardDefinition,
): WorldState {
  if (
    proposal.failureResolution?.finalDisposition === "discard" &&
    proposal.deckChange
  ) {
    return {
      ...world,
      deck: cloneDeckState(proposal.deckChange.after),
      updatedAt: world.updatedAt,
    };
  }

  if (!proposal.valid || !proposal.resultingWorld || !proposal.deckChange) {
    return world;
  }

  const action: WorldAction = {
    id: `sim-${world.history.length + 1}`,
    sequence: (world.history.at(-1)?.sequence ?? 0) + 1,
    cardId: card.id,
    cardName: card.name,
    cardInstanceId: proposal.cardInstanceId ?? "",
    effectiveCardDefinitionSummary: structuredClone(proposal.effectiveCardSummary ?? {}),
    failureAttempts: structuredClone(proposal.failureResolution?.attempts ?? []),
    deckMutations: structuredClone(proposal.deckChange.mutations),
    targetIds: [...proposal.targetIds],
    targetResolution: proposal.targetResolution
      ? toTargetResolutionRecord(proposal.targetResolution)
      : {
          originIds: [],
          destinationIds: [],
          selectedIds: [],
          expandedTargetIds: [...proposal.targetIds],
          resolvedValues: structuredClone(proposal.resolvedValues),
        },
    propagationRecords: proposal.propagationResults.map((result, effectIndex) =>
      toPropagationRecord(result, effectIndex),
    ),
    appliedAt: world.updatedAt,
    changes: [...proposal.cardChanges, ...proposal.consequenceChanges].map((change) => ({
      tileId: change.tileId,
      before: change.before ? structuredClone(change.before) : null,
      after: structuredClone(change.after),
    })),
    randomSeed: proposal.randomSeed,
    resolvedValues: structuredClone(proposal.resolvedValues),
    turn: proposal.nextTurn,
    consequences: structuredClone(proposal.consequences),
    regionChanges: structuredClone(proposal.regionChanges),
    routeChanges: structuredClone(proposal.routeChanges),
  };

  return {
    ...proposal.resultingWorld,
    deck: cloneDeckState(proposal.deckChange.after),
    history: [...world.history, action],
    updatedAt: world.updatedAt,
  };
}

export function simulateDeck(
  initialWorld: WorldState,
  turns: number,
  seed: string,
): SimulationResult {
  let world = structuredClone(initialWorld);
  const metrics: SimulationMetrics = {
    turnsCompleted: 0,
    successfulPlays: 0,
    discardedPlays: 0,
    failedPlays: 0,
    tilesCreated: 0,
    routesCreated: 0,
    deckMutationsApplied: 0,
    maxPropagationSteps: 0,
    shuffleCount: world.deck.shuffleCount,
  };

  let stoppedReason: SimulationResult["stoppedReason"] = "completed";

  for (let turn = 0; turn < turns; turn++) {
    if (world.deck.drawPile.length === 0 && !world.deck.activeInstanceId) {
      stoppedReason = "empty-deck";
      break;
    }

    if (!world.deck.activeInstanceId) {
      const drawResult = drawCard(world.deck, `${seed}:draw:${turn}:${buildShuffleSeed(world)}`);

      if (!drawResult.ok || !drawResult.drawnInstance) {
        stoppedReason = "empty-deck";
        break;
      }

      world = {
        ...world,
        deck: drawResult.deck,
      };
      metrics.shuffleCount = world.deck.shuffleCount;
    }

    const instance = getActiveInstance(world.deck);

    if (!instance) {
      stoppedReason = "stalled";
      break;
    }

    const definition = getCardDefinition(instance.definitionId);

    if (!definition) {
      metrics.failedPlays += 1;
      stoppedReason = "stalled";
      break;
    }

    const randomSeed = `${seed}:turn:${turn}:${instance.instanceId}`;
    const selectionTileIds = buildSimulationSelectionTileIds(world, definition, randomSeed);
    const proposal = proposeCardPlay(world, selectionTileIds, randomSeed);

    if (!canCommitProposal(proposal)) {
      const discardResult = discardActiveCard(world.deck);

      if (discardResult.ok) {
        world = {
          ...world,
          deck: discardResult.deck,
        };
        metrics.discardedPlays += 1;
        metrics.turnsCompleted += 1;
        continue;
      }

      metrics.failedPlays += 1;
      stoppedReason = "stalled";
      break;
    }

    const tilesBefore = Object.keys(world.tiles).length;
    const routesBefore = Object.keys(world.travelRoutes).length;
    world = applyProposalInMemory(world, proposal, definition);
    const tilesAfter = Object.keys(world.tiles).length;
    const routesAfter = Object.keys(world.travelRoutes).length;

    metrics.tilesCreated += Math.max(0, tilesAfter - tilesBefore);
    metrics.routesCreated += Math.max(0, routesAfter - routesBefore);
    metrics.deckMutationsApplied += proposal.deckChange?.mutations.length ?? 0;

    for (const propagation of proposal.propagationResults) {
      metrics.maxPropagationSteps = Math.max(
        metrics.maxPropagationSteps,
        propagation.steps.length,
      );
    }

    if (proposal.valid) {
      metrics.successfulPlays += 1;
    } else if (proposal.failureResolution?.finalDisposition === "discard") {
      metrics.discardedPlays += 1;
    } else {
      metrics.failedPlays += 1;
    }

    metrics.turnsCompleted += 1;
  }

  if (metrics.turnsCompleted >= turns && stoppedReason === "completed") {
    stoppedReason = "max-turns";
  }

  return {
    finalWorld: world,
    metrics,
    history: world.history,
    stoppedReason,
  };
}
