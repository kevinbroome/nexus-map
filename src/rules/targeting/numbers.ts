import type { NumberDefinition } from "./types";
import type { TargetResolutionContext } from "./types";
import { createSeededRandom } from "../random";

export type NumberResolution = {
  value: number;
  resolvedValues: Record<string, unknown>;
  error?: string;
};

export function resolveNumber(
  definition: NumberDefinition,
  context: TargetResolutionContext,
  key: string,
  options: {
    originTileId?: string;
    connectedRegionSize?: number;
    minimum?: number;
    requirePositive?: boolean;
  } = {},
): NumberResolution {
  const resolvedValues: Record<string, unknown> = {};
  let value = 0;

  switch (definition.type) {
    case "fixed":
      value = definition.value;
      break;

    case "random-range": {
      if (definition.minimum > definition.maximum) {
        return {
          value: 0,
          resolvedValues,
          error: `Random range ${key} has minimum greater than maximum.`,
        };
      }

      const random = createSeededRandom(`${context.randomSeed}:${key}`);
      value =
        definition.minimum +
        Math.floor(random() * (definition.maximum - definition.minimum + 1));
      resolvedValues[`${key}.randomRange`] = {
        minimum: definition.minimum,
        maximum: definition.maximum,
        value,
      };
      break;
    }

    case "card-value":
      return {
        value: 0,
        resolvedValues,
        error: "Card numeric values are not supported yet.",
      };

    case "previous-action-size": {
      const previousCount =
        context.previousAction?.targetResolution?.expandedTargetIds.length ??
        context.previousAction?.targetIds.length ??
        0;
      value = previousCount;
      resolvedValues[`${key}.previousActionSize`] = value;
      break;
    }

    case "connected-region-size":
      value = options.connectedRegionSize ?? 0;
      resolvedValues[`${key}.connectedRegionSize`] = value;
      break;

    case "settlement-tier-value": {
      const tile = options.originTileId
        ? context.world.tiles[options.originTileId]
        : undefined;
      const tier = tile?.settlement?.type === "village"
        ? "village"
        : tile?.settlement?.type === "ruin"
          ? "ruin"
          : undefined;
      value =
        (tier && definition.values[tier as keyof typeof definition.values]) ??
        definition.fallback;
      resolvedValues[`${key}.settlementTierValue`] = { tier, value };
      break;
    }

    default: {
      const unreachable: never = definition;
      return {
        value: 0,
        resolvedValues,
        error: `Unsupported number definition: ${String(unreachable)}`,
      };
    }
  }

  if (options.minimum !== undefined && value < options.minimum) {
    return {
      value,
      resolvedValues,
      error: `${key} resolved to ${value}, but at least ${options.minimum} is required.`,
    };
  }

  if (options.requirePositive && value <= 0) {
    return {
      value,
      resolvedValues,
      error: `${key} must be greater than zero.`,
    };
  }

  if (value < 0) {
    return {
      value,
      resolvedValues,
      error: `${key} cannot be negative.`,
    };
  }

  resolvedValues[key] = value;
  return { value, resolvedValues };
}
