import type { CardDefinition } from "../cards/cardTypes";
import { autoCentreTileTarget } from "../cards/cardTargets";
import type { SelectionState } from "../selection/selectionTypes";
import type { WorldState } from "../world/worldTypes";
import { getPropagatingEffects } from "./propagation/propagate";
import { getWorldCentreTileId } from "./targeting/directions";
import type { TargetResolutionContext } from "./targeting/types";
import { resolveTargets, getEffectTargetIds } from "./targeting/resolveTargets";

export type TargetResolution =
  | { ok: true; targetIds: string[]; result: import("./targeting/types").TargetResolutionResult }
  | { ok: false; messages: string[]; result: import("./targeting/types").TargetResolutionResult | null };

export function buildTargetResolutionContext(
  world: WorldState,
  card: CardDefinition,
  selection?: SelectionState,
  randomSeed = "",
  previousAction?: import("../world/worldTypes").WorldAction,
  selectionTileIds: string[] = [],
): TargetResolutionContext {
  return {
    world,
    card,
    primarySelectionId:
      selection?.routeOriginTileId ??
      selection?.tileIds[0] ??
      selectionTileIds[0],
    secondarySelectionId:
      selection?.routeDestinationTileId ??
      selection?.tileIds[1] ??
      selectionTileIds[1],
    previousAction,
    randomSeed,
  };
}

function cardSupportsSeedFallbackTargeting(card: CardDefinition): boolean {
  return getPropagatingEffects(card.effects).some((effect) => effect.seedFallback);
}

export function resolveCardTargets(
  world: WorldState,
  card: CardDefinition,
  selectionTileIds: string[],
  selection?: SelectionState,
  randomSeed = "",
  previousAction?: import("../world/worldTypes").WorldAction,
): TargetResolution {
  const context = buildTargetResolutionContext(
    world,
    card,
    selection,
    randomSeed,
    previousAction,
    selectionTileIds,
  );
  const result = resolveTargets(card.target, context);

  if (!result.valid && cardSupportsSeedFallbackTargeting(card)) {
    const centreId = getWorldCentreTileId(world);
    const fallbackTarget = autoCentreTileTarget([]);
    const fallbackContext: TargetResolutionContext = {
      ...context,
      primarySelectionId: centreId,
    };
    const fallbackResult = resolveTargets(fallbackTarget, fallbackContext);

    if (fallbackResult.valid) {
      return {
        ok: true,
        targetIds: getEffectTargetIds(fallbackResult, fallbackTarget),
        result: {
          ...fallbackResult,
          resolvedValues: {
            ...fallbackResult.resolvedValues,
            seedFallbackTargeting: true,
          },
        },
      };
    }
  }

  if (!result.valid) {
    return {
      ok: false,
      messages: result.validationMessages,
      result,
    };
  }

  return {
    ok: true,
    targetIds: getEffectTargetIds(result, card.target),
    result,
  };
}
