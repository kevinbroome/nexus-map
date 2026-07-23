import type { CardDefinition } from "../cards/cardTypes";
import type { DeckManifestEntry } from "../cards/advancedDeck/advancedDeckManifest";
import { findValidTargetTileIds } from "../rules/failure/autoTarget";
import { proposeAction } from "../rules/engine";
import { getWorldCentreTileId } from "../rules/targeting/directions";
import type { WorldState } from "../world/worldTypes";

export interface FreshWorldViabilityResult {
  viable: boolean;
  immediatelyPlayable: string[];
  temporarilyBlocked: string[];
  warnings: string[];
}

function hasSafeDiscardFailure(definition: CardDefinition): boolean {
  if (definition.defaultFailureBehaviour?.type === "discard") {
    return true;
  }

  return Object.values(definition.failureBehaviours ?? {}).some(
    (behaviour) => behaviour?.type === "discard",
  );
}

export function checkFreshWorldViability(
  world: WorldState,
  definitions: CardDefinition[],
  manifest: DeckManifestEntry[],
): FreshWorldViabilityResult {
  const definitionMap = new Map(definitions.map((entry) => [entry.id, entry]));
  const immediatelyPlayable: string[] = [];
  const temporarilyBlocked: string[] = [];
  const warnings: string[] = [];
  const centreId = getWorldCentreTileId(world);

  for (const entry of manifest) {
    const definition = definitionMap.get(entry.definitionId);

    if (!definition) {
      warnings.push(`Skipping viability check for missing definition "${entry.definitionId}".`);
      continue;
    }

    const validTargets = findValidTargetTileIds(world, definition, "viability-check");
    const preview = proposeAction(
      world,
      definition,
      validTargets.length > 0 ? validTargets : [centreId],
      `viability:${entry.definitionId}`,
    );

    if (preview.valid) {
      if (!immediatelyPlayable.includes(entry.definitionId)) {
        immediatelyPlayable.push(entry.definitionId);
      }
      continue;
    }

    temporarilyBlocked.push(entry.definitionId);

    if (!hasSafeDiscardFailure(definition)) {
      warnings.push(
        `"${entry.definitionId}" may fail on a fresh world without a safe discard path.`,
      );
    }
  }

  return {
    viable: immediatelyPlayable.length > 0,
    immediatelyPlayable,
    temporarilyBlocked,
    warnings,
  };
}
