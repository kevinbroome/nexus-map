import type { CardDefinition, ProposedAction } from "../cards/cardTypes";
import { createInvalidProposal } from "../cards/cardTypes";
import {
  applyDeckMutations,
  buildEffectiveDefinitionSummary,
} from "../deck/deckMutations";
import { cloneDeckState, type ProposedDeckChange } from "../deck/deckTypes";
import { discardActiveCard } from "../deck/deckOperations";
import { getActiveInstance, getCardDefinition } from "../deck/deckQueries";
import { ensureActiveCardForDefinition } from "../deck/deckQueries";
import { resolveEffectiveCardDefinition } from "../deck/effectiveCard";
import type { SelectionState } from "../selection/selectionTypes";
import type { WorldState } from "../world/worldTypes";
import { proposeAction } from "./engine";
import {
  buildCardFailure,
  inferFailureStageFromProposal,
  resolveCardFailureChain,
} from "./failure/resolveFailure";
import { createRandomSeed } from "./random";
import type { TargetResolutionContext } from "./targeting/types";

export function buildPreviewActionId(randomSeed: string): string {
  return `preview:${randomSeed}`;
}

function describeDeckMutation(change: ProposedDeckChange): string[] {
  const lines: string[] = [];

  for (const mutation of change.mutations) {
    switch (mutation.type) {
      case "active-card-moved":
        lines.push(`Move active card to ${mutation.destination}.`);
        break;
      case "card-retired":
        lines.push(`Retire card ${mutation.instanceId}.`);
        break;
      case "card-added":
        lines.push(`Add card to ${mutation.destination}.`);
        break;
      case "card-copied":
        lines.push(
          `Copy card into ${mutation.destination} (${mutation.createdInstanceIds.length} created).`,
        );
        break;
      case "card-modified":
        lines.push(`Modify card ${mutation.instanceId} (${mutation.modification.type}).`);
        break;
      case "modification-removed":
        lines.push(`Remove modifications from ${mutation.instanceId}.`);
        break;
      case "pile-shuffled":
        lines.push(`Shuffle ${mutation.source}.`);
        break;
      default:
        break;
    }
  }

  lines.push(
    `Draw: ${change.after.drawPile.length}, Discard: ${change.after.discardPile.length}, Retired: ${change.after.retiredPile.length}.`,
  );

  return lines;
}

function buildDeckChangePreview(
  world: WorldState,
  card: CardDefinition,
  activeInstanceId: string,
  randomSeed: string,
  resolvedValues: Record<string, unknown>,
): { ok: boolean; deckChange?: ProposedDeckChange; messages: string[] } {
  const before = cloneDeckState(world.deck);
  const discardResult = discardActiveCard(before);

  if (!discardResult.ok) {
    return { ok: false, messages: discardResult.messages };
  }

  const numberContext: TargetResolutionContext = {
    world,
    card,
    randomSeed,
  };

  const mutationResult = applyDeckMutations(card.deckMutations, {
    deck: discardResult.deck,
    card,
    activeInstanceId,
    turn: world.turn + 1,
    actionId: buildPreviewActionId(randomSeed),
    randomSeed,
    resolvedValues: { ...resolvedValues },
    numberContext,
    previousPlayedInstanceId: world.history.at(-1)?.cardInstanceId,
  });

  if (!mutationResult.ok) {
    return { ok: false, messages: mutationResult.messages };
  }

  return {
    ok: true,
    deckChange: {
      before,
      after: mutationResult.deck,
      mutations: [...discardResult.mutations, ...mutationResult.mutations],
    },
    messages: [],
  };
}

export function attachDeckChangeToProposal(
  world: WorldState,
  card: CardDefinition,
  proposal: ProposedAction,
): ProposedAction {
  const instance = getActiveInstance(world.deck);

  if (!instance) {
    throw new Error("No active card to play.");
  }

  if (
    proposal.failureResolution?.finalDisposition === "discard" &&
    !proposal.valid
  ) {
    const deckChange = buildDiscardOnlyDeckChange(world);

    return {
      ...proposal,
      cardInstanceId: instance.instanceId,
      deckChange,
      validationMessages: [
        ...proposal.validationMessages,
        ...describeDeckMutation(deckChange),
      ],
    };
  }

  if (!proposal.valid || !proposal.resultingWorld) {
    return {
      ...proposal,
      cardInstanceId: instance.instanceId,
    };
  }

  const deckPreview = buildDeckChangePreview(
    world,
    card,
    instance.instanceId,
    proposal.randomSeed,
    proposal.resolvedValues,
  );

  if (!deckPreview.ok || !deckPreview.deckChange) {
    return {
      ...proposal,
      valid: false,
      cardInstanceId: instance.instanceId,
      validationMessages: [...proposal.validationMessages, ...deckPreview.messages],
    };
  }

  return {
    ...proposal,
    cardInstanceId: instance.instanceId,
    deckChange: deckPreview.deckChange,
    resultingWorld: {
      ...proposal.resultingWorld,
      deck: deckPreview.deckChange.after,
    },
    validationMessages: [
      ...proposal.validationMessages,
      ...describeDeckMutation(deckPreview.deckChange),
    ],
  };
}

export function finalizeProposalForCommit(
  world: WorldState,
  card: CardDefinition,
  selectionTileIds: string[],
  randomSeed: string | undefined,
  expectedProposal: ProposedAction | undefined,
  selection?: SelectionState,
): ProposedAction {
  const preparedWorld = ensureActiveCardForDefinition(world, card.id);

  if (expectedProposal && !expectedProposal.cardInstanceId) {
    return attachDeckChangeToProposal(preparedWorld, card, expectedProposal);
  }

  return proposeCardPlay(
    preparedWorld,
    selectionTileIds,
    randomSeed,
    selection,
  );
}

export function buildDiscardOnlyDeckChange(world: WorldState): ProposedDeckChange {
  const before = cloneDeckState(world.deck);
  const discardResult = discardActiveCard(before);

  if (!discardResult.ok || !discardResult.deck) {
    throw new Error(discardResult.messages.join("\n") || "Could not discard active card.");
  }

  return {
    before,
    after: discardResult.deck,
    mutations: discardResult.mutations,
  };
}

export function proposeCardPlay(
  world: WorldState,
  selectionTileIds: string[],
  randomSeed: string = createRandomSeed(),
  selection?: SelectionState,
): ProposedAction {
  const instance = getActiveInstance(world.deck);

  if (!instance) {
    return createInvalidProposal("", [], ["No active card to play."], randomSeed);
  }

  const baseDefinition = getCardDefinition(instance.definitionId);

  if (!baseDefinition) {
    return createInvalidProposal(
      instance.definitionId,
      [],
      [`Unknown card definition "${instance.definitionId}".`],
      randomSeed,
    );
  }

  const effectiveResult = resolveEffectiveCardDefinition(baseDefinition, instance);

  if (!effectiveResult.ok) {
    return createInvalidProposal(
      instance.definitionId,
      [],
      effectiveResult.messages,
      randomSeed,
    );
  }

  const effective = effectiveResult.definition;
  let proposal = proposeAction(
    world,
    effective,
    selectionTileIds,
    randomSeed,
    selection,
  );

  proposal = {
    ...proposal,
    cardId: effective.id,
    cardInstanceId: instance.instanceId,
    effectiveCardSummary: buildEffectiveDefinitionSummary(effective),
  };

  if (!proposal.valid) {
    const stage = inferFailureStageFromProposal(proposal);
    const failure = buildCardFailure(
      stage,
      proposal.validationMessages.join(" ") || "Card could not resolve.",
    );
    const failureResolution = resolveCardFailureChain({
      world,
      card: effective,
      selectionTileIds,
      randomSeed,
      selection,
      previousAction: world.history.at(-1),
      failure,
      stage,
    });

    if (
      failureResolution.resolved &&
      failureResolution.finalDisposition === "discard"
    ) {
      const deckChange = buildDiscardOnlyDeckChange(world);

      return {
        ...proposal,
        valid: false,
        failureResolution,
        deckChange,
        resultingWorld: null,
        nextTurn: world.turn,
        validationMessages: [
          ...failureResolution.validationMessages,
          ...describeDeckMutation(deckChange),
        ],
      };
    }

    if (failureResolution.resolved && failureResolution.finalProposal) {
      proposal = {
        ...failureResolution.finalProposal,
        cardInstanceId: instance.instanceId,
        effectiveCardSummary: buildEffectiveDefinitionSummary(effective),
        failureResolution,
      };
    } else {
      return {
        ...proposal,
        failureResolution,
        validationMessages: [
          ...proposal.validationMessages,
          ...failureResolution.validationMessages,
        ],
      };
    }
  }

  const deckPreview = buildDeckChangePreview(
    world,
    effective,
    instance.instanceId,
    randomSeed,
    proposal.resolvedValues,
  );

  if (!deckPreview.ok || !deckPreview.deckChange) {
    return {
      ...proposal,
      valid: false,
      validationMessages: [...proposal.validationMessages, ...deckPreview.messages],
    };
  }

  const resultingWorld = proposal.resultingWorld
    ? { ...proposal.resultingWorld, deck: deckPreview.deckChange.after }
    : null;

  return {
    ...proposal,
    deckChange: deckPreview.deckChange,
    resultingWorld,
    validationMessages: [
      ...proposal.validationMessages,
      ...describeDeckMutation(deckPreview.deckChange),
    ],
  };
}

export function canCommitProposal(proposal: ProposedAction): boolean {
  if (proposal.valid && proposal.resultingWorld && proposal.deckChange) {
    return true;
  }

  return (
    proposal.failureResolution?.resolved === true &&
    proposal.failureResolution.finalDisposition === "discard" &&
    Boolean(proposal.deckChange)
  );
}

export function resolveEffectiveCardForActiveInstance(
  world: WorldState,
): { card: CardDefinition; instanceId: string } | null {
  const instance = getActiveInstance(world.deck);

  if (!instance) {
    return null;
  }

  const baseDefinition = getCardDefinition(instance.definitionId);

  if (!baseDefinition) {
    return null;
  }

  const effectiveResult = resolveEffectiveCardDefinition(baseDefinition, instance);

  if (!effectiveResult.ok) {
    return null;
  }

  return {
    card: effectiveResult.definition,
    instanceId: instance.instanceId,
  };
}
