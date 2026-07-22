import type { PropagatingEffectDefinition, PropagationResult } from "./types";

export function describePropagationDefinition(
  definition: PropagatingEffectDefinition,
): string {
  const parts: string[] = [];

  switch (definition.strategy.type) {
    case "breadth-first":
      parts.push("Spread outward evenly through neighbours");
      break;
    case "random-frontier":
      parts.push("Spread randomly across the frontier");
      break;
    case "weighted-frontier":
      parts.push("Spread preferring lower traversal cost");
      break;
    case "directional":
      parts.push("Spread primarily in one direction");
      break;
    case "random-walk":
      parts.push("Walk randomly one step at a time");
      break;
    case "follow-terrain":
      parts.push("Follow matching terrain only");
      break;
    case "follow-network":
      parts.push("Follow the connected travel network");
      break;
    default:
      parts.push("Spread using configured strategy");
  }

  parts.push("until the requested number of tiles are affected");

  if (definition.boundary?.type === "create-blank-tiles") {
    parts.push("and create blank tiles at the boundary");
  } else if (definition.boundary?.type === "create-operation-terrain") {
    parts.push("and create new tiles with the propagated terrain at the boundary");
  } else if (definition.boundary?.type === "discard-overflow") {
    parts.push("while ignoring missing coordinates");
  }

  return `${parts.join(", ")}.`;
}

export function describePropagationResult(result: PropagationResult): string[] {
  const totalCost = result.steps.reduce(
    (sum, step) => sum + (Number.isFinite(step.accumulatedCost) ? step.accumulatedCost : 0),
    0,
  );

  return [
    `Seeds: ${result.seedTileIds.length}`,
    `Affected tiles: ${result.affectedTileIds.length}`,
    `New tiles created: ${result.createdTileIds.length}`,
    `Blocked tiles: ${result.blockedTileIds.length}`,
    `Total propagation cost: ${totalCost}`,
  ];
}
