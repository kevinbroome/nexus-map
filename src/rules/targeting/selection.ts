import type { TargetResolutionContext, TargetSelectionDefinition } from "./types";
import { resolveNumber } from "./numbers";
import { createSeededRandom, pickRandomItems } from "../random";

export function applySelection(
  orderedCandidateIds: string[],
  selection: TargetSelectionDefinition | undefined,
  context: TargetResolutionContext,
  key = "selection",
): {
  selectedIds: string[];
  resolvedValues: Record<string, unknown>;
  error?: string;
} {
  const resolvedValues: Record<string, unknown> = {};
  const rule = selection ?? { type: "all" as const };

  switch (rule.type) {
    case "all":
      return { selectedIds: orderedCandidateIds, resolvedValues };

    case "first":
      if (orderedCandidateIds.length === 0) {
        return {
          selectedIds: [],
          resolvedValues,
          error: "No candidates remain to select.",
        };
      }

      return { selectedIds: [orderedCandidateIds[0]!], resolvedValues };

    case "count": {
      const countResult = resolveNumber(rule.count, context, `${key}.count`, {
        minimum: 1,
        requirePositive: true,
      });

      if (countResult.error) {
        return { selectedIds: [], resolvedValues, error: countResult.error };
      }

      Object.assign(resolvedValues, countResult.resolvedValues);

      if (orderedCandidateIds.length < countResult.value) {
        return {
          selectedIds: [],
          resolvedValues,
          error: `Requested ${countResult.value} targets but only ${orderedCandidateIds.length} candidates remain.`,
        };
      }

      return {
        selectedIds: orderedCandidateIds.slice(0, countResult.value),
        resolvedValues,
      };
    }

    case "random-one": {
      if (orderedCandidateIds.length === 0) {
        return {
          selectedIds: [],
          resolvedValues,
          error: "No candidates remain to select randomly.",
        };
      }

      const random = createSeededRandom(`${context.randomSeed}:${key}:random-one`);
      const [picked] = pickRandomItems(orderedCandidateIds, 1, random);
      resolvedValues[`${key}.randomOne`] = picked;
      return { selectedIds: [picked!], resolvedValues };
    }

    case "random-count": {
      const countResult = resolveNumber(rule.count, context, `${key}.count`, {
        minimum: 1,
        requirePositive: true,
      });

      if (countResult.error) {
        return { selectedIds: [], resolvedValues, error: countResult.error };
      }

      if (orderedCandidateIds.length < countResult.value) {
        return {
          selectedIds: [],
          resolvedValues,
          error: `Requested ${countResult.value} random targets but only ${orderedCandidateIds.length} candidates remain.`,
        };
      }

      const random = createSeededRandom(`${context.randomSeed}:${key}:random-count`);
      const picked = pickRandomItems(
        orderedCandidateIds,
        countResult.value,
        random,
      );
      resolvedValues[`${key}.randomCount`] = picked;
      Object.assign(resolvedValues, countResult.resolvedValues);
      return { selectedIds: picked, resolvedValues };
    }

    case "nearest-one":
    case "farthest-one":
      if (orderedCandidateIds.length === 0) {
        return {
          selectedIds: [],
          resolvedValues,
          error: "No candidates remain to select.",
        };
      }

      return { selectedIds: [orderedCandidateIds[0]!], resolvedValues };

    default: {
      const unreachable: never = rule;
      return {
        selectedIds: [],
        resolvedValues,
        error: `Unsupported selection rule: ${String(unreachable)}`,
      };
    }
  }
}
