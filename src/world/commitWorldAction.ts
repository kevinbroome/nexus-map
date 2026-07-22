import type { CardDefinition } from "../cards/cardTypes";
import {
  formatProposalMessage,
  proposeAction,
  proposalsAreEqual,
} from "../rules/engine";
import type { SelectionState } from "../selection/selectionTypes";
import { saveWorld } from "../persistence/worldStorage";
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

export type CommitResult = {
  world: WorldState;
  action: WorldAction;
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

export function commitWorldAction(
  world: WorldState,
  card: CardDefinition,
  selectionTileIds: string[],
  randomSeed?: string,
  expectedProposal?: ReturnType<typeof proposeAction>,
  selection?: SelectionState,
): CommitResult {
  const proposal = proposeAction(
    world,
    card,
    selectionTileIds,
    randomSeed,
    selection,
  );

  if (!proposal.valid || !proposal.resultingWorld) {
    throw new Error(formatProposalMessage(proposal));
  }

  if (expectedProposal && !proposalsAreEqual(proposal, expectedProposal)) {
    throw new Error(
      "The preview no longer matches the current world. Select the card again.",
    );
  }

  const allChanges = [...proposal.cardChanges, ...proposal.consequenceChanges].map(
    (change) => ({
      tileId: change.tileId,
      before: change.before ? cloneValue(change.before) : null,
      after: cloneValue(change.after),
    }),
  );

  const action: WorldAction = {
    id: crypto.randomUUID(),
    sequence: getNextSequence(world),
    cardId: card.id,
    cardName: card.name,
    targetIds: [...proposal.targetIds],
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
    history: [...world.history, action],
    updatedAt: new Date().toISOString(),
  };

  try {
    saveWorld(updatedWorld);
  } catch {
    throw new Error("The action could not be saved. The world was not changed.");
  }

  return {
    world: updatedWorld,
    action,
    message: formatCommitMessage(action),
  };
}
