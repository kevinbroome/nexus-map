import type { EffectDefinition, ProposedAction } from "../../cards/cardTypes";
import type { TargetDefinition } from "../targeting/types";
import type { ValidTargetCreationDefinition } from "./failureStrategies";
import type { SelectionState } from "../../selection/selectionTypes";
import type { WorldAction, WorldState } from "../../world/worldTypes";

export type FailureStage =
  | "origin"
  | "candidate-search"
  | "filtering"
  | "selection"
  | "target-requirements"
  | "propagation"
  | "replacement"
  | "route-pathfinding"
  | "world-law-validation"
  | "deck-mutation";

export type FailureBehaviourDefinition =
  | { type: "fail" }
  | { type: "discard" }
  | { type: "draw-another"; maximumAdditionalDraws?: number }
  | { type: "nearest-valid-target"; maximumDistance?: number }
  | { type: "random-valid-target" }
  | {
      type: "create-valid-target";
      creation: ValidTargetCreationDefinition;
    }
  | { type: "apply-fallback-effect"; effects: EffectDefinition[] }
  | { type: "reduce-magnitude"; minimum: number; decrement?: number }
  | { type: "retarget"; target: TargetDefinition };

export interface CardFailure {
  stage: FailureStage;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface FailureAttemptRecord {
  attempt: number;
  behaviourType: FailureBehaviourDefinition["type"];
  result: "resolved" | "failed";
  messages: string[];
  resolvedValues: Record<string, unknown>;
}

export interface FailureResolutionResult {
  resolved: boolean;
  finalProposal?: ProposedAction;
  finalDisposition?: "discard" | "remain-active";
  attempts: FailureAttemptRecord[];
  validationMessages: string[];
}

export interface CardResolutionContext {
  world: WorldState;
  card: import("../../cards/cardTypes").CardDefinition;
  selectionTileIds: string[];
  randomSeed: string;
  selection?: SelectionState;
  previousAction?: WorldAction;
  stage: FailureStage;
  failure: CardFailure;
  attempt: number;
  retargetDepth: number;
}
