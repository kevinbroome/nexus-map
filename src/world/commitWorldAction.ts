import type { CardDefinition } from "../cards/cardTypes";
import {
  formatProposalMessage,
  proposeAction,
  proposalsAreEqual,
} from "../rules/engine";
import { saveWorld } from "../persistence/worldStorage";
import type { WorldAction, WorldState } from "./worldTypes";
import { cloneTile } from "./tileUtils";

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

export function getLatestActionSequence(world: WorldState): number {
  return world.history.at(-1)?.sequence ?? 0;
}

function getNextSequence(world: WorldState): number {
  return getLatestActionSequence(world) + 1;
}

function buildUpdatedWorld(
  world: WorldState,
  action: WorldAction,
): WorldState {
  const tiles = { ...world.tiles };

  for (const change of action.changes) {
    tiles[change.tileId] = cloneTile(change.after);
  }

  return {
    ...world,
    tiles,
    history: [...world.history, action],
    updatedAt: new Date().toISOString(),
  };
}

export type CommitResult = {
  world: WorldState;
  action: WorldAction;
  message: string;
};

export function formatCommitMessage(action: WorldAction): string {
  const primaryChange = action.changes[0];
  const tileLabel = primaryChange
    ? `${primaryChange.after.x},${primaryChange.after.y}`
    : action.targetIds[0] ?? "unknown";

  return `Applied "${action.cardName}" to tile ${tileLabel}.\nWorld saved. Action #${action.sequence}.`;
}

export function commitWorldAction(
  world: WorldState,
  card: CardDefinition,
  selectionTileIds: string[],
  randomSeed?: string,
  expectedProposal?: ReturnType<typeof proposeAction>,
): CommitResult {
  const proposal = proposeAction(
    world,
    card,
    selectionTileIds,
    randomSeed,
  );

  if (!proposal.valid) {
    throw new Error(formatProposalMessage(proposal));
  }

  if (expectedProposal && !proposalsAreEqual(proposal, expectedProposal)) {
    throw new Error(
      "The preview no longer matches the current world. Select the card again.",
    );
  }

  const action: WorldAction = {
    id: crypto.randomUUID(),
    sequence: getNextSequence(world),
    cardId: card.id,
    cardName: card.name,
    targetIds: [...proposal.targetIds],
    appliedAt: new Date().toISOString(),
    changes: proposal.changes.map((change) => ({
      tileId: change.tileId,
      before: change.before ? cloneValue(change.before) : null,
      after: cloneValue(change.after),
    })),
    randomSeed: proposal.randomSeed,
    resolvedValues: cloneValue(proposal.resolvedValues),
  };
  const updatedWorld = buildUpdatedWorld(world, action);

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
