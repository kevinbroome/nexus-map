import type { CardDefinition, ProposedAction } from "../../cards/cardTypes";
import type { PropagatingEffectDefinition } from "../propagation/types";
import { proposeAction } from "../engine";
import {
  MAX_FAILURE_ATTEMPTS,
  MAX_MAGNITUDE_REDUCTIONS,
  MAX_RETARGET_DEPTH,
} from "../../deck/constants";
import type {
  CardFailure,
  CardResolutionContext,
  FailureAttemptRecord,
  FailureBehaviourDefinition,
  FailureResolutionResult,
} from "./failureTypes";
import { isUnsupportedFailureBehaviour } from "./failureStrategies";

function getFailureBehaviour(
  card: CardDefinition,
  stage: CardFailure["stage"],
): FailureBehaviourDefinition {
  return (
    card.failureBehaviours?.[stage] ??
    card.defaultFailureBehaviour ??
    { type: "fail" }
  );
}

function reducePropagationMagnitude(
  card: CardDefinition,
  decrement: number,
  minimum: number,
): CardDefinition {
  const next = structuredClone(card);

  next.effects = next.effects.map((effect) => {
    if (effect.type !== "propagate") {
      return effect;
    }

    const propagate = effect as PropagatingEffectDefinition;

    if (propagate.magnitude.type === "fixed") {
      return {
        ...propagate,
        magnitude: {
          type: "fixed",
          value: Math.max(minimum, propagate.magnitude.value - decrement),
        },
      };
    }

    return effect;
  });

  return next;
}

function recordAttempt(
  attempt: number,
  behaviour: FailureBehaviourDefinition,
  result: "resolved" | "failed",
  messages: string[],
  resolvedValues: Record<string, unknown>,
): FailureAttemptRecord {
  return {
    attempt,
    behaviourType: behaviour.type,
    result,
    messages,
    resolvedValues,
  };
}

export function resolveCardFailureChain(
  context: Omit<CardResolutionContext, "attempt" | "retargetDepth" | "failure" | "stage"> & {
    failure: CardFailure;
    stage: CardFailure["stage"];
  },
): FailureResolutionResult {
  const attempts: FailureAttemptRecord[] = [];
  const validationMessages: string[] = [];
  let card = context.card;
  let retargetDepth = 0;
  let magnitudeReductions = 0;

  for (let attempt = 1; attempt <= MAX_FAILURE_ATTEMPTS; attempt++) {
    const behaviour = getFailureBehaviour(card, context.stage);
    const unsupported = isUnsupportedFailureBehaviour(behaviour);

    if (unsupported) {
      attempts.push(
        recordAttempt(attempt, behaviour, "failed", [unsupported], {}),
      );
      validationMessages.push(unsupported);
      break;
    }

    const resolvedValues: Record<string, unknown> = {};

    switch (behaviour.type) {
      case "fail":
        attempts.push(
          recordAttempt(attempt, behaviour, "failed", [context.failure.message], {}),
        );
        validationMessages.push(context.failure.message);
        return { resolved: false, attempts, validationMessages };

      case "discard":
        attempts.push(
          recordAttempt(attempt, behaviour, "resolved", ["Card will be discarded."], {}),
        );
        return {
          resolved: true,
          finalDisposition: "discard",
          attempts,
          validationMessages: ["Failure behaviour: discard without changing the world."],
        };

      case "apply-fallback-effect": {
        const fallbackCard: CardDefinition = {
          ...structuredClone(card),
          effects: behaviour.effects,
        };
        const proposal = proposeAction(
          context.world,
          fallbackCard,
          context.selectionTileIds,
          context.randomSeed,
          context.selection,
        );

        if (proposal.valid) {
          resolvedValues.fallbackUsed = true;
          attempts.push(
            recordAttempt(attempt, behaviour, "resolved", ["Fallback effect applied."], resolvedValues),
          );
          return {
            resolved: true,
            finalProposal: proposal,
            attempts,
            validationMessages: ["Failure behaviour: fallback effect will be committed."],
          };
        }

        attempts.push(
          recordAttempt(
            attempt,
            behaviour,
            "failed",
            proposal.validationMessages,
            resolvedValues,
          ),
        );
        validationMessages.push(...proposal.validationMessages);
        break;
      }

      case "retarget": {
        if (retargetDepth >= MAX_RETARGET_DEPTH) {
          attempts.push(
            recordAttempt(attempt, behaviour, "failed", ["Retarget depth limit reached."], {}),
          );
          validationMessages.push("Retarget depth limit reached.");
          break;
        }

        card = {
          ...structuredClone(card),
          target: behaviour.target,
        };
        retargetDepth += 1;
        resolvedValues.retargetDepth = retargetDepth;

        const proposal = proposeAction(
          context.world,
          card,
          context.selectionTileIds,
          context.randomSeed,
          context.selection,
        );

        if (proposal.valid) {
          attempts.push(
            recordAttempt(attempt, behaviour, "resolved", ["Retarget succeeded."], resolvedValues),
          );
          return {
            resolved: true,
            finalProposal: proposal,
            attempts,
            validationMessages: ["Failure behaviour: retarget succeeded."],
          };
        }

        attempts.push(
          recordAttempt(
            attempt,
            behaviour,
            "failed",
            proposal.validationMessages,
            resolvedValues,
          ),
        );
        validationMessages.push(...proposal.validationMessages);
        break;
      }

      case "reduce-magnitude": {
        if (magnitudeReductions >= MAX_MAGNITUDE_REDUCTIONS) {
          attempts.push(
            recordAttempt(
              attempt,
              behaviour,
              "failed",
              ["Magnitude reduction limit reached."],
              {},
            ),
          );
          validationMessages.push("Magnitude reduction limit reached.");
          break;
        }

        const decrement = behaviour.decrement ?? 1;
        card = reducePropagationMagnitude(card, decrement, behaviour.minimum);
        magnitudeReductions += 1;
        resolvedValues.magnitudeReductions = magnitudeReductions;
        resolvedValues.reducedMagnitudeAttempt = magnitudeReductions;

        const proposal = proposeAction(
          context.world,
          card,
          context.selectionTileIds,
          context.randomSeed,
          context.selection,
        );

        if (proposal.valid) {
          attempts.push(
            recordAttempt(
              attempt,
              behaviour,
              "resolved",
              ["Reduced magnitude succeeded."],
              resolvedValues,
            ),
          );
          return {
            resolved: true,
            finalProposal: proposal,
            attempts,
            validationMessages: ["Failure behaviour: reduced magnitude succeeded."],
          };
        }

        attempts.push(
          recordAttempt(
            attempt,
            behaviour,
            "failed",
            proposal.validationMessages,
            resolvedValues,
          ),
        );

        if (
          !card.effects.some(
            (effect: CardDefinition["effects"][number]) =>
              effect.type === "propagate" &&
              effect.magnitude.type === "fixed" &&
              effect.magnitude.value > behaviour.minimum,
          )
        ) {
          validationMessages.push("Reduced magnitude reached minimum without success.");
          const fallback = card.defaultFailureBehaviour ?? { type: "fail" as const };

          if (fallback.type === "discard") {
            attempts.push(
              recordAttempt(
                attempt,
                fallback,
                "resolved",
                ["Reduced magnitude failed; discarding card."],
                resolvedValues,
              ),
            );
            return {
              resolved: true,
              finalDisposition: "discard",
              attempts,
              validationMessages: [
                "Failure behaviour: reduced magnitude reached minimum, card will be discarded.",
              ],
            };
          }

          if (fallback.type === "fail") {
            attempts.push(
              recordAttempt(attempt, fallback, "failed", [context.failure.message], {}),
            );
            validationMessages.push(context.failure.message);
            return { resolved: false, attempts, validationMessages };
          }
        }
        break;
      }

      case "nearest-valid-target":
      case "random-valid-target":
        attempts.push(
          recordAttempt(
            attempt,
            behaviour,
            "failed",
            [`${behaviour.type} is not fully implemented yet.`],
            {},
          ),
        );
        validationMessages.push(`${behaviour.type} is not fully implemented yet.`);
        break;

      default:
        validationMessages.push(
          `Unsupported failure behaviour: ${(behaviour as FailureBehaviourDefinition).type}`,
        );
        break;
    }
  }

  return {
    resolved: false,
    attempts,
    validationMessages:
      validationMessages.length > 0
        ? validationMessages
        : ["Failure resolution exhausted all attempts."],
  };
}

export function resolveCardFailure(
  failure: CardFailure,
  behaviour: FailureBehaviourDefinition,
  context: CardResolutionContext,
): FailureResolutionResult {
  void behaviour;
  return resolveCardFailureChain({
    world: context.world,
    card: context.card,
    selectionTileIds: context.selectionTileIds,
    randomSeed: context.randomSeed,
    selection: context.selection,
    previousAction: context.previousAction,
    failure,
    stage: context.stage,
  });
}

export function inferFailureStageFromProposal(proposal: ProposedAction): CardFailure["stage"] {
  if (proposal.propagationResults.some((result) => !result.valid)) {
    return "propagation";
  }

  if (proposal.targetResolution && !proposal.targetResolution.valid) {
    return "selection";
  }

  return "target-requirements";
}

export function buildCardFailure(
  stage: CardFailure["stage"],
  message: string,
  code = "resolution-failed",
): CardFailure {
  return { stage, code, message, details: {} };
}
