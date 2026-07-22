import type { TargetResolutionContext } from "../targeting/types";import type { PropagationContext } from "./types";

export function toTargetResolutionContext(
  context: PropagationContext,
): TargetResolutionContext {
  return {
    world: context.world,
    card: context.card,
    primarySelectionId: context.seedTileIds[0],
    previousAction: context.previousAction,
    randomSeed: context.randomSeed,
  };
}

export function propagationEffectKey(context: PropagationContext): string {
  return `propagation.${context.effectIndex ?? 0}`;
}
