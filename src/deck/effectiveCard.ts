import type { CardDefinition } from "../cards/cardTypes";
import type { PropagatingEffectDefinition } from "../rules/propagation/types";
import type { CardModification, EffectiveCardDefinition } from "./deckTypes";

export type ModificationApplyResult =
  | { ok: true; definition: EffectiveCardDefinition }
  | { ok: false; messages: string[] };

function applyMagnitudeAdjustment(
  definition: EffectiveCardDefinition,
  amount: number,
): void {
  definition.effects = definition.effects.map((effect) => {
    if (effect.type !== "propagate") {
      return effect;
    }

    const propagate = effect as PropagatingEffectDefinition;

    if (propagate.magnitude.type === "fixed") {
      return {
        ...propagate,
        magnitude: {
          type: "fixed",
          value: propagate.magnitude.value + amount,
        },
      };
    }

    if (propagate.magnitude.type === "random-range") {
      return {
        ...propagate,
        magnitude: {
          ...propagate.magnitude,
          minimum: propagate.magnitude.minimum + amount,
          maximum: propagate.magnitude.maximum + amount,
        },
      };
    }

    return effect;
  });

  definition.modificationSummary.push(`Magnitude ${amount >= 0 ? "+" : ""}${amount}`);
}

function applyAddTargetFilter(
  definition: EffectiveCardDefinition,
  filter: import("../rules/targeting/types").TargetFilterDefinition,
): void {
  definition.target = {
    ...definition.target,
    filters: [...(definition.target.filters ?? []), filter],
  };
  definition.modificationSummary.push(`Added target filter: ${filter.type}`);
}

function applyReplaceOperationTerrain(
  definition: EffectiveCardDefinition,
  terrain: import("../world/worldTypes").TerrainType,
): void {
  definition.effects = definition.effects.map((effect) => {
    if (effect.type !== "propagate") {
      return effect;
    }

    if (effect.operation.type !== "set-terrain") {
      return effect;
    }

    return {
      ...effect,
      operation: { type: "set-terrain", terrain },
    };
  });

  definition.modificationSummary.push(`Operation terrain replaced with ${terrain}`);
}

function applyAddResistance(
  definition: EffectiveCardDefinition,
  resistance: import("../rules/propagation/types").ResistanceDefinition,
): void {
  definition.effects = definition.effects.map((effect) => {
    if (effect.type !== "propagate") {
      return effect;
    }

    return {
      ...effect,
      resistance: [...(effect.resistance ?? []), resistance],
    };
  });

  definition.modificationSummary.push(`Added ${resistance.type} resistance`);
}

function applyRename(definition: EffectiveCardDefinition, name: string): void {
  definition.name = name;
  definition.modificationSummary.push(`Renamed to "${name}"`);
}

function applyAddTag(definition: EffectiveCardDefinition, tag: string): void {
  definition.description = `${definition.description} [${tag}]`;
  definition.modificationSummary.push(`Tagged "${tag}"`);
}

export function applyModification(
  definition: EffectiveCardDefinition,
  modification: CardModification,
): ModificationApplyResult {
  const next: EffectiveCardDefinition = structuredClone(definition);

  switch (modification.type) {
    case "magnitude-adjustment":
      applyMagnitudeAdjustment(next, modification.amount);
      break;
    case "add-target-filter":
      applyAddTargetFilter(next, modification.filter);
      break;
    case "remove-target-filter":
      next.target = {
        ...next.target,
        filters: (next.target.filters ?? []).filter(
          (_, index) => index !== modification.filterIndex,
        ),
      };
      next.modificationSummary.push(`Removed target filter ${modification.filterIndex}`);
      break;
    case "replace-operation-terrain":
      applyReplaceOperationTerrain(next, modification.terrain);
      break;
    case "add-resistance":
      applyAddResistance(next, modification.resistance);
      break;
    case "add-tag":
      applyAddTag(next, modification.tag);
      break;
    case "rename":
      applyRename(next, modification.name);
      break;
    default: {
      const unreachable: never = modification;
      return {
        ok: false,
        messages: [`Unsupported modification: ${String(unreachable)}`],
      };
    }
  }

  return { ok: true, definition: next };
}

export function resolveEffectiveCardDefinition(
  definition: CardDefinition,
  instance: import("./deckTypes").DeckCardInstance,
): ModificationApplyResult {
  let effective: EffectiveCardDefinition = {
    ...structuredClone(definition),
    instanceId: instance.instanceId,
    baseDefinitionId: instance.definitionId,
    appliedModifications: [],
    modificationSummary: [],
  };

  for (const modification of instance.modifications) {
    const result = applyModification(effective, modification);

    if (!result.ok) {
      return result;
    }

    effective = result.definition;
    effective.appliedModifications.push(structuredClone(modification));
  }

  return { ok: true, definition: effective };
}
