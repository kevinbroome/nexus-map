import type { WorldConsequence } from "../world/worldTypes";
import { SETTLEMENT_TIER_DISPLAY_NAMES } from "./constants";

export function formatConsequence(consequence: WorldConsequence): string {
  switch (consequence.type) {
    case "village-decline-advanced":
      return `Village at ${formatTileId(consequence.tileId)} inhospitable turns: ${consequence.currentTurns} / 3.`;

    case "village-became-ruin":
      return `Village at ${formatTileId(consequence.tileId)} will become a ruin.`;

    case "settlement-region-formed":
      return `This action will create 1 ${SETTLEMENT_TIER_DISPLAY_NAMES[consequence.tier]}.`;

    case "settlement-region-dissolved":
      return `${SETTLEMENT_TIER_DISPLAY_NAMES[consequence.tier]} region ${consequence.regionId} will dissolve.`;

    default: {
      const unreachable: never = consequence;
      return String(unreachable);
    }
  }
}

export function formatConsequencesSummary(
  consequences: WorldConsequence[],
): string[] {
  const formedCounts = new Map<string, number>();
  let ruinCount = 0;

  for (const consequence of consequences) {
    switch (consequence.type) {
      case "settlement-region-formed": {
        const label = SETTLEMENT_TIER_DISPLAY_NAMES[consequence.tier];
        formedCounts.set(label, (formedCounts.get(label) ?? 0) + 1);
        break;
      }

      case "village-became-ruin":
        ruinCount += 1;
        break;

      default:
        break;
    }
  }

  const messages: string[] = [];

  for (const [label, count] of [...formedCounts.entries()].sort()) {
    messages.push(`${count} ${label}${count === 1 ? "" : "s"} formed.`);
  }

  if (ruinCount > 0) {
    messages.push(
      `${ruinCount} village${ruinCount === 1 ? "" : "s"} became a ruin.`,
    );
  }

  return messages;
}

export function formatConsequencePreviewMessages(
  consequences: WorldConsequence[],
): string[] {
  const messages: string[] = [];
  const seen = new Set<string>();

  for (const consequence of consequences) {
    const message = formatConsequence(consequence);

    if (seen.has(message)) {
      continue;
    }

    seen.add(message);
    messages.push(message);
  }

  return messages;
}

function formatTileId(tileId: string): string {
  return tileId;
}
