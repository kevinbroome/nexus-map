import type { CardDefinition } from "../../cards/cardTypes";
import { getExistingTiles } from "../../world/coordinates";
import { getWorldCentreTileId } from "../targeting/directions";
import { applyTargetFilters } from "../targeting/filters";
import { resolveTargets } from "../targeting/resolveTargets";
import type { TargetDefinition, TargetResolutionContext } from "../targeting/types";
import { createSeededRandom, pickRandomItems } from "../random";
import { distanceBetween, sortTileIds } from "../targeting/utils";
import type { WorldState } from "../../world/worldTypes";

function autoTargetDefinition(card: CardDefinition): TargetDefinition {
  const origin = card.target.origin;

  if (
    origin.type === "random-existing-tile" ||
    origin.type === "random-boundary-tile" ||
    origin.type === "nearest-settlement"
  ) {
    return structuredClone(card.target);
  }

  return {
    ...structuredClone(card.target),
    origin: { type: "world-centre" },
  };
}

export function findValidTargetTileIds(
  world: WorldState,
  card: CardDefinition,
  randomSeed: string,
): string[] {
  const context: TargetResolutionContext = {
    world,
    card,
    randomSeed,
    primarySelectionId: getWorldCentreTileId(world),
    secondarySelectionId: undefined,
  };

  const result = resolveTargets(autoTargetDefinition(card), context);

  if (result.valid && result.expandedTargetIds.length > 0) {
    return result.expandedTargetIds;
  }

  if (result.valid && result.selectedIds.length > 0) {
    return result.selectedIds;
  }

  const candidates = sortTileIds(getExistingTiles(world).map((tile) => tile.id));
  return applyTargetFilters(world, candidates, card.target.filters ?? [], {
    originTileId: getWorldCentreTileId(world),
  });
}

export function pickNearestValidTarget(
  world: WorldState,
  card: CardDefinition,
  referenceTileId: string,
  randomSeed: string,
  maximumDistance?: number,
): string | null {
  const valid = findValidTargetTileIds(world, card, randomSeed).filter((tileId) => {
    if (maximumDistance === undefined) {
      return true;
    }

    return (
      distanceBetween(tileId, referenceTileId, "manhattan") <= maximumDistance
    );
  });

  if (valid.length === 0) {
    return null;
  }

  valid.sort((left, right) => {
    const leftDistance = distanceBetween(left, referenceTileId, "manhattan");
    const rightDistance = distanceBetween(right, referenceTileId, "manhattan");

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    return left.localeCompare(right);
  });

  return valid[0] ?? null;
}

export function pickRandomValidTarget(
  world: WorldState,
  card: CardDefinition,
  randomSeed: string,
): string | null {
  const valid = findValidTargetTileIds(world, card, randomSeed);

  if (valid.length === 0) {
    return null;
  }

  const random = createSeededRandom(`${randomSeed}:random-valid-target`);
  const [picked] = pickRandomItems(valid, 1, random);
  return picked ?? null;
}

export function buildSimulationSelectionTileIds(
  world: WorldState,
  card: CardDefinition,
  randomSeed: string,
): string[] {
  const context: TargetResolutionContext = {
    world,
    card,
    randomSeed,
    primarySelectionId: getWorldCentreTileId(world),
  };

  const preview = resolveTargets(autoTargetDefinition(card), context);

  if (preview.valid) {
    if (card.target.destination) {
      return [
        preview.originIds[0] ?? getWorldCentreTileId(world),
        preview.destinationIds[0] ?? preview.selectedIds[0] ?? getWorldCentreTileId(world),
      ].filter(Boolean);
    }

    return preview.selectedIds.length > 0
      ? preview.selectedIds
      : preview.originIds;
  }

  const fallback = pickRandomValidTarget(world, card, randomSeed);
  return fallback ? [fallback] : [getWorldCentreTileId(world)];
}
