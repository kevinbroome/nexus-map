import type { CardDefinition, ProposedAction } from "../cards/cardTypes";
import { toPropagationRecord, toTargetResolutionRecord } from "../cards/cardTypes";
import {
  formatProposalMessage,
  getPropagationRecords,
  getTargetResolutionRecord,
  proposalsAreEqual,
} from "../rules/engine";
import {
  canCommitProposal,
  finalizeProposalForCommit,
  proposeCardPlay,
} from "../rules/proposeCardPlay";
import { ensureActiveCardForDefinition } from "../deck/deckQueries";
import type { PropagationRecord } from "../rules/propagation/types";
import type { TargetResolutionRecord } from "../rules/targeting/types";
import type { SelectionState } from "../selection/selectionTypes";
import { persistCommittedWorld } from "../persistence/persistCommittedWorld";
import { formatConsequencesSummary } from "../worldLaws/consequenceMessages";
import type { WorldAction, WorldState } from "./worldTypes";

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

export function getLatestActionSequence(world: WorldState): number {
  return world.history.at(-1)?.sequence ?? 0;
}

function getNextSequence(world: WorldState): number {
  return getLatestActionSequence(world) + 1;
}

function targetResolutionRecordsMatch(
  left: TargetResolutionRecord,
  right: TargetResolutionRecord,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function propagationRecordsMatch(
  left: PropagationRecord[],
  right: PropagationRecord[],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function deckChangesMatch(
  left: ProposedAction["deckChange"],
  right: ProposedAction["deckChange"],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export type CommitResult = {
  world: WorldState;
  action?: WorldAction;
  message: string;
};

export function formatCommitMessage(action: WorldAction): string {
  const consequenceSummary = formatConsequencesSummary(action.consequences);
  const routeSummary =
    action.routeChanges.filter((change) => change.type === "created").length > 0
      ? ["1 road created."]
      : [];
  const lines = [
    `Action committed. Turn ${action.turn}.`,
    ...routeSummary,
    ...consequenceSummary,
    "World saved.",
  ];

  return lines.join("\n");
}

async function commitDiscardOnlyFailure(
  world: WorldState,
  expectedProposal: ProposedAction,
): Promise<CommitResult> {
  if (
    expectedProposal.failureResolution?.finalDisposition !== "discard" ||
    !expectedProposal.deckChange
  ) {
    throw new Error("This proposal cannot be committed as a discard-only failure.");
  }

  const updatedWorld: WorldState = {
    ...world,
    deck: cloneValue(expectedProposal.deckChange.after),
    updatedAt: new Date().toISOString(),
  };

  try {
    await persistCommittedWorld(updatedWorld, {
      failureMessage: "The discard could not be saved. The world was not changed.",
    });
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("The discard could not be saved. The world was not changed.");
  }

  return {
    world: updatedWorld,
    message: "Failure behaviour discarded the active card without changing the world.",
  };
}

export async function commitWorldAction(
  world: WorldState,
  card: CardDefinition,
  selectionTileIds: string[],
  randomSeed?: string,
  expectedProposal?: ReturnType<typeof proposeCardPlay>,
  selection?: SelectionState,
): Promise<CommitResult> {
  const preparedWorld = ensureActiveCardForDefinition(world, card.id);
  const proposal = finalizeProposalForCommit(
    preparedWorld,
    card,
    selectionTileIds,
    randomSeed,
    expectedProposal,
    selection,
  );

  if (!canCommitProposal(proposal)) {
    throw new Error(formatProposalMessage(proposal));
  }

  const expectedFinal = expectedProposal
    ? finalizeProposalForCommit(
        preparedWorld,
        card,
        selectionTileIds,
        randomSeed,
        expectedProposal,
        selection,
      )
    : null;

  if (expectedFinal && !proposalsAreEqual(proposal, expectedFinal)) {
    throw new Error(
      "The preview no longer matches the current world. Select the card again.",
    );
  }

  if (
    proposal.failureResolution?.finalDisposition === "discard" &&
    !proposal.valid
  ) {
    if (
      expectedFinal &&
      !deckChangesMatch(proposal.deckChange, expectedFinal.deckChange)
    ) {
      throw new Error(
        "Deck changes changed between preview and commit. Draw the card again.",
      );
    }

    return await commitDiscardOnlyFailure(world, proposal);
  }

  if (!proposal.valid || !proposal.resultingWorld || !proposal.deckChange) {
    throw new Error(formatProposalMessage(proposal));
  }

  const expectedRecord = expectedFinal
    ? getTargetResolutionRecord(expectedFinal)
    : null;
  const commitRecord = getTargetResolutionRecord(proposal);

  if (
    expectedRecord &&
    commitRecord &&
    !targetResolutionRecordsMatch(expectedRecord, commitRecord)
  ) {
    throw new Error(
      "Target resolution changed between preview and commit. Select the card again.",
    );
  }

  const expectedPropagation = expectedFinal
    ? getPropagationRecords(expectedFinal)
    : null;
  const commitPropagation = getPropagationRecords(proposal);

  if (
    expectedPropagation &&
    !propagationRecordsMatch(expectedPropagation, commitPropagation)
  ) {
    throw new Error(
      "Propagation changed between preview and commit. Select the card again.",
    );
  }

  if (
    expectedFinal &&
    !deckChangesMatch(proposal.deckChange, expectedFinal.deckChange)
  ) {
    throw new Error(
      "Deck changes changed between preview and commit. Draw the card again.",
    );
  }

  const allChanges = [...proposal.cardChanges, ...proposal.consequenceChanges].map(
    (change) => ({
      tileId: change.tileId,
      before: change.before ? cloneValue(change.before) : null,
      after: cloneValue(change.after),
    }),
  );

  const targetResolution = commitRecord
    ? cloneValue(commitRecord)
    : proposal.targetResolution
      ? toTargetResolutionRecord(proposal.targetResolution)
      : {
          originIds: [],
          destinationIds: [],
          selectedIds: [],
          expandedTargetIds: [...proposal.targetIds],
          resolvedValues: cloneValue(proposal.resolvedValues),
        };

  const propagationRecords =
    commitPropagation.length > 0
      ? cloneValue(commitPropagation)
      : proposal.propagationResults.map((result, effectIndex) =>
          toPropagationRecord(result, effectIndex),
        );

  const action: WorldAction = {
    id: crypto.randomUUID(),
    sequence: getNextSequence(world),
    cardId: card.id,
    cardName: card.name,
    cardInstanceId: proposal.cardInstanceId ?? "",
    effectiveCardDefinitionSummary: cloneValue(
      proposal.effectiveCardSummary ?? {},
    ),
    failureAttempts: cloneValue(proposal.failureResolution?.attempts ?? []),
    deckMutations: cloneValue(proposal.deckChange.mutations),
    targetIds: [...proposal.targetIds],
    targetResolution,
    propagationRecords,
    appliedAt: new Date().toISOString(),
    changes: allChanges,
    randomSeed: proposal.randomSeed,
    resolvedValues: cloneValue(proposal.resolvedValues),
    turn: proposal.nextTurn,
    consequences: cloneValue(proposal.consequences),
    regionChanges: cloneValue(proposal.regionChanges),
    routeChanges: cloneValue(proposal.routeChanges),
  };

  const updatedWorld: WorldState = {
    ...proposal.resultingWorld,
    deck: cloneValue(proposal.deckChange.after),
    history: [...world.history, action],
    updatedAt: new Date().toISOString(),
  };

  try {
    await persistCommittedWorld(updatedWorld, {
      failureMessage: "The action could not be saved. The world was not changed.",
    });
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("The action could not be saved. The world was not changed.");
  }

  return {
    world: updatedWorld,
    action,
    message: formatCommitMessage(action),
  };
}
