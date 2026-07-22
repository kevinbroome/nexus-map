import type { TargetDefinition, TargetResolutionResult } from "./types";

export function describeTargetDefinition(definition: TargetDefinition): string {
  const parts: string[] = [];

  switch (definition.origin.type) {
    case "primary-selection":
      parts.push("Start from the primary selected tile");
      break;
    case "secondary-selection":
      parts.push("Start from the secondary selected tile");
      break;
    case "nearest-settlement":
      parts.push("Start from the nearest settlement");
      break;
    default:
      parts.push(`Start from ${definition.origin.type.replace(/-/g, " ")}`);
  }

  if (definition.destination) {
    parts.push("and use a secondary endpoint");
  }

  if (definition.search) {
    switch (definition.search.type) {
      case "origin-only":
        parts.push("at the origin");
        break;
      case "adjacent":
        parts.push("including adjacent tiles");
        break;
      case "within-distance":
        parts.push("within the configured distance");
        break;
      case "exact-distance":
        parts.push("at the exact configured distance");
        break;
      case "connected-region":
        parts.push("across the connected region");
        break;
      case "map-boundary":
        parts.push("on the map boundary");
        break;
      case "nearest":
        parts.push("at the nearest matching location");
        break;
      case "direction":
        parts.push("in the resolved direction");
        break;
      case "along-route":
        parts.push("along the travel network");
        break;
      default:
        break;
    }
  }

  if (definition.selection) {
    switch (definition.selection.type) {
      case "all":
        parts.push("affect all valid candidates");
        break;
      case "first":
        parts.push("choose the first valid candidate");
        break;
      case "random-one":
        parts.push("choose one random valid candidate");
        break;
      case "random-count":
        parts.push("choose random valid candidates");
        break;
      case "nearest-one":
        parts.push("choose the nearest valid candidate");
        break;
      case "count":
        parts.push("choose the requested number of candidates");
        break;
      default:
        break;
    }
  }

  if (definition.expansion && definition.expansion.type !== "none") {
    parts.push(`then expand using ${definition.expansion.type}`);
  }

  return `${parts.join(", ")}.`;
}

export function describeResolvedTargets(
  result: TargetResolutionResult,
): string[] {
  const lines = [
    `Origin: ${result.originIds.join(", ") || "none"}`,
    `Candidates found: ${result.candidateIds.length}`,
    `After filters: ${result.filteredCandidateIds.length}`,
    `Selected: ${result.selectedIds.join(", ") || "none"}`,
    `Final affected tiles: ${result.expandedTargetIds.length}`,
  ];

  if (result.destinationIds.length > 0) {
    lines.splice(1, 0, `Destination: ${result.destinationIds.join(", ")}`);
  }

  return lines;
}
