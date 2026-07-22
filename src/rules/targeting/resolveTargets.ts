import type {
  TargetDefinition,
  TargetResolutionContext,
  TargetResolutionResult,
} from "./types";
import { resolveOrigin } from "./origins";
import { applySearch } from "./search";
import { applyTargetFilters } from "./filters";
import { applyOrdering } from "./ordering";
import { applySelection } from "./selection";
import { applyExpansion } from "./expansion";
import { validateTargetRequirements } from "./requirements";
import { sortTileIds } from "./utils";

export function resolveTargets(
  definition: TargetDefinition,
  context: TargetResolutionContext,
): TargetResolutionResult {
  const resolvedValues: Record<string, unknown> = {};
  const validationMessages: string[] = [];

  const originResult = resolveOrigin(definition.origin, context, "origin");

  if (originResult.error) {
    return {
      valid: false,
      originIds: [],
      destinationIds: [],
      candidateIds: [],
      filteredCandidateIds: [],
      selectedIds: [],
      expandedTargetIds: [],
      validationMessages: [originResult.error],
      resolvedValues: { ...resolvedValues, ...originResult.resolvedValues },
    };
  }

  Object.assign(resolvedValues, originResult.resolvedValues);
  const originIds = sortTileIds(originResult.tileIds);
  let destinationIds: string[] = [];

  if (definition.destination) {
    const destinationResult = resolveOrigin(
      definition.destination,
      context,
      "destination",
    );

    if (destinationResult.error) {
      return {
        valid: false,
        originIds,
        destinationIds: [],
        candidateIds: [],
        filteredCandidateIds: [],
        selectedIds: [],
        expandedTargetIds: [],
        validationMessages: [destinationResult.error],
        resolvedValues: {
          ...resolvedValues,
          ...destinationResult.resolvedValues,
        },
      };
    }

    Object.assign(resolvedValues, destinationResult.resolvedValues);
    destinationIds = sortTileIds(destinationResult.tileIds);
  }

  const search = definition.search ?? { type: "origin-only" as const };
  const searchResult = applySearch(search, context, originIds, "search");

  if (searchResult.error) {
    return {
      valid: false,
      originIds,
      destinationIds,
      candidateIds: [],
      filteredCandidateIds: [],
      selectedIds: [],
      expandedTargetIds: [],
      validationMessages: [searchResult.error],
      resolvedValues: { ...resolvedValues, ...searchResult.resolvedValues },
    };
  }

  Object.assign(resolvedValues, searchResult.resolvedValues);
  const candidateIds = sortTileIds(searchResult.candidateIds);
  const filteredCandidateIds = sortTileIds(
    applyTargetFilters(context.world, candidateIds, definition.filters ?? [], {
      originTileId: originIds[0],
    }),
  );

  const orderingResult = applyOrdering(
    context.world,
    filteredCandidateIds,
    definition.ordering,
    context,
    originIds[0]!,
  );
  Object.assign(resolvedValues, orderingResult.resolvedValues);

  const selectionResult = applySelection(
    orderingResult.orderedIds,
    definition.selection,
    context,
  );

  if (selectionResult.error) {
    return {
      valid: false,
      originIds,
      destinationIds,
      candidateIds,
      filteredCandidateIds,
      selectedIds: [],
      expandedTargetIds: [],
      validationMessages: [selectionResult.error],
      resolvedValues: { ...resolvedValues, ...selectionResult.resolvedValues },
    };
  }

  Object.assign(resolvedValues, selectionResult.resolvedValues);
  const selectedIds = sortTileIds(selectionResult.selectedIds);

  const expansionResult = applyExpansion(
    definition.expansion,
    context,
    selectedIds,
    originIds[0]!,
  );

  if (expansionResult.error) {
    return {
      valid: false,
      originIds,
      destinationIds,
      candidateIds,
      filteredCandidateIds,
      selectedIds,
      expandedTargetIds: [],
      validationMessages: [expansionResult.error],
      resolvedValues: { ...resolvedValues, ...expansionResult.resolvedValues },
    };
  }

  Object.assign(resolvedValues, expansionResult.resolvedValues);
  const expandedTargetIds = sortTileIds(expansionResult.expandedTargetIds);

  validationMessages.push(
    ...validateTargetRequirements(
      context.world,
      expandedTargetIds,
      definition.requirements,
    ),
  );

  if (originIds.length === 0) {
    validationMessages.push("Target origin could not be resolved.");
  }

  return {
    valid: validationMessages.length === 0,
    originIds,
    destinationIds,
    candidateIds,
    filteredCandidateIds,
    selectedIds,
    expandedTargetIds,
    validationMessages,
    resolvedValues,
  };
}

export function getEffectTargetIds(
  result: TargetResolutionResult,
  definition: TargetDefinition,
): string[] {
  if (definition.destination) {
    return sortTileIds([
      ...new Set([...result.originIds, ...result.destinationIds]),
    ]);
  }

  return result.expandedTargetIds;
}

export function getRouteEndpointTileIds(
  result: TargetResolutionResult,
): [string | undefined, string | undefined] {
  const originId = result.originIds[0];
  const destinationId =
    result.destinationIds[0] ??
    result.selectedIds.find((tileId) => tileId !== originId);

  return [originId, destinationId];
}
