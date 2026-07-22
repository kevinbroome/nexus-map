import type { MapTile, TerrainType } from "../../world/worldTypes";
import { DEFAULT_TERRAIN_PRIORITIES } from "./constants";
import type {
  PropagationOperationDefinition,
  ReplacementPolicyDefinition,
} from "./types";

export function getOperationTerrain(
  operation: PropagationOperationDefinition,
): TerrainType | undefined {
  return operation.type === "set-terrain" ? operation.terrain : undefined;
}

export function getTerrainPriority(
  terrain: TerrainType,
  policy?: ReplacementPolicyDefinition,
): number {
  if (policy?.type === "priority") {
    return policy.terrainPriorities[terrain] ?? DEFAULT_TERRAIN_PRIORITIES[terrain];
  }

  return DEFAULT_TERRAIN_PRIORITIES[terrain];
}

export function canReplaceTile(
  tile: MapTile,
  operation: PropagationOperationDefinition,
  policy: ReplacementPolicyDefinition | undefined,
): { allowed: boolean; reason?: string } {
  const effectivePolicy = policy ?? { type: "allow-all" as const };
  const targetTerrain = getOperationTerrain(operation);

  switch (effectivePolicy.type) {
    case "allow-all":
      return { allowed: true };

    case "only":
      if (!targetTerrain) {
        return { allowed: true };
      }

      if (!effectivePolicy.terrains.includes(tile.terrain)) {
        return {
          allowed: false,
          reason: `${tile.terrain} is not in the allowed replacement list.`,
        };
      }

      return { allowed: true };

    case "exclude":
      if (effectivePolicy.terrains.includes(tile.terrain)) {
        return {
          allowed: false,
          reason: `${tile.terrain} is excluded from replacement.`,
        };
      }

      return { allowed: true };

    case "priority": {
      const existingPriority = getTerrainPriority(tile.terrain, effectivePolicy);
      const incomingPriority = effectivePolicy.incomingPriority;

      if (incomingPriority > existingPriority) {
        return { allowed: true };
      }

      if (
        incomingPriority === existingPriority &&
        effectivePolicy.allowEqual !== false
      ) {
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: `${tile.terrain} has priority ${existingPriority}, incoming priority is ${incomingPriority}.`,
      };
    }

    case "matrix": {
      if (!targetTerrain) {
        return effectivePolicy.default === "allow"
          ? { allowed: true }
          : { allowed: false, reason: "Matrix policy denies this operation." };
      }

      const rule = effectivePolicy.rules.find(
        (entry) => entry.from === tile.terrain && entry.to === targetTerrain,
      );

      if (rule) {
        return rule.allowed
          ? { allowed: true }
          : {
              allowed: false,
              reason: `Matrix denies replacing ${tile.terrain} with ${targetTerrain}.`,
            };
      }

      return effectivePolicy.default === "allow"
        ? { allowed: true }
        : {
            allowed: false,
            reason: `Matrix denies replacing ${tile.terrain} with ${targetTerrain}.`,
          };
    }

    default: {
      const unreachable: never = effectivePolicy;
      return {
        allowed: false,
        reason: `Unsupported replacement policy: ${String(unreachable)}`,
      };
    }
  }
}
