import type { CardDefinition, ProposedAction } from "../cards/cardTypes";
import type { MapTile, TileChange, WorldState } from "../world/worldTypes";
import { cloneTile } from "../world/tileUtils";
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

export function proposeAction(
  world: WorldState,
  card: CardDefinition,
  selectionTileIds: string[],
  randomSeed: string = createRandomSeed(),
): ProposedAction {
  const targetResolution = resolveCardTargets(
    world,
    card.target,
    selectionTileIds,
  );

  if (!targetResolution.ok) {
    return {
      cardId: card.id,
      targetIds: [],
      valid: false,
      validationMessages: targetResolution.messages,
      changes: [],
      randomSeed,
      resolvedValues: {},
    };
  }

  const targetIds = targetResolution.targetIds;
  const validationMessages: string[] = [];
  const modifiedTiles: Record<string, MapTile> = {};
  const resolvedValues: Record<string, unknown> = {};

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

    try {
      Object.assign(
        modifiedTiles,
        applyEffectsToTile(
          world,
          tile,
          card.effects,
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

  const changes = buildTileChanges(world, modifiedTiles);

  if (changes.length === 0) {
    return {
      cardId: card.id,
      targetIds,
      valid: false,
      validationMessages:
        validationMessages.length > 0
          ? validationMessages
          : ["No valid targets were found for this card."],
      changes: [],
      randomSeed,
      resolvedValues,
    };
  }

  const successMessage = `${changes.length} tile(s) will change.`;

  return {
    cardId: card.id,
    targetIds,
    valid: true,
    validationMessages:
      validationMessages.length > 0
        ? [...validationMessages, successMessage]
        : [successMessage],
    changes,
    randomSeed,
    resolvedValues,
  };
}

export function getPreviewTileIds(proposal: ProposedAction): string[] {
  if (proposal.changes.length > 0) {
    return proposal.changes.map((change) => change.tileId);
  }

  return proposal.targetIds;
}

export function formatProposalMessage(proposal: ProposedAction): string {
  return proposal.validationMessages.join(" ");
}

export function proposalsAreEqual(
  left: ProposedAction,
  right: ProposedAction,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
