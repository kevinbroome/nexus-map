import type { CardDefinition } from "../cards/cardTypes";
import type { SelectionState } from "../selection/selectionTypes";
import type { WorldState } from "../world/worldTypes";
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
