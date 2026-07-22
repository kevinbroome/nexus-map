import { validateCardApplication } from "../cards/validateCard";
import type { CardDefinition } from "../cards/cardTypes";
import { proposeCardChanges } from "../cards/applyCard";
import { saveWorld } from "../persistence/worldStorage";
import type { TileChange, WorldAction, WorldState } from "./worldTypes";

function cloneTile<T>(value: T): T {
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
  changes: TileChange[],
  action: WorldAction,
): WorldState {
  const tiles = { ...world.tiles };

  for (const change of changes) {
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
  targetIds: string[],
): CommitResult {
  const validation = validateCardApplication(world, card, targetIds);

  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const changes = proposeCardChanges(world, card, targetIds);
  const action: WorldAction = {
    id: crypto.randomUUID(),
    sequence: getNextSequence(world),
    cardId: card.id,
    cardName: card.name,
    targetIds: [...targetIds],
    appliedAt: new Date().toISOString(),
    changes: changes.map((change) => ({
      tileId: change.tileId,
      before: cloneTile(change.before),
      after: cloneTile(change.after),
    })),
  };
  const updatedWorld = buildUpdatedWorld(world, changes, action);

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
