import { getConnectedRegion } from "../../world/neighbours";
import { isBoundaryTile } from "../../world/tileCreation";
import { getRoutesThroughTile } from "../../networks/networkQueries";
import type { TargetRequirementDefinition, TargetResolutionContext } from "./types";

export function validateTargetRequirements(
  world: TargetResolutionContext["world"],
  targetIds: string[],
  requirements: TargetRequirementDefinition[] | undefined,
): string[] {
  if (!requirements || requirements.length === 0) {
    return [];
  }

  const messages: string[] = [];

  for (const requirement of requirements) {
    switch (requirement.type) {
      case "minimum-target-count":
        if (targetIds.length < requirement.count) {
          messages.push(
            `At least ${requirement.count} targets are required, but ${targetIds.length} were resolved.`,
          );
        }
        break;

      case "maximum-target-count":
        if (targetIds.length > requirement.count) {
          messages.push(
            `At most ${requirement.count} targets are allowed, but ${targetIds.length} were resolved.`,
          );
        }
        break;

      case "all-targets-must-exist":
        for (const tileId of targetIds) {
          if (!world.tiles[tileId]) {
            messages.push(`Target tile "${tileId}" does not exist.`);
          }
        }
        break;

      case "all-targets-must-be-missing":
        for (const tileId of targetIds) {
          if (world.tiles[tileId]) {
            messages.push(`Target coordinate "${tileId}" must be missing.`);
          }
        }
        break;

      case "targets-must-be-connected": {
        if (targetIds.length <= 1) {
          break;
        }

        const firstTile = world.tiles[targetIds[0]!];

        if (!firstTile) {
          break;
        }

        const connected = new Set(
          getConnectedRegion(
            world,
            firstTile.id,
            (tile) => targetIds.includes(tile.id),
            requirement.mode ?? "cardinal",
          ).map((tile) => tile.id),
        );

        if (connected.size !== targetIds.length) {
          messages.push("Resolved targets are not fully connected.");
        }
        break;
      }

      case "must-include-boundary-tile":
        if (!targetIds.some((tileId) => isBoundaryTile(world, tileId))) {
          messages.push("At least one boundary tile is required.");
        }
        break;

      case "must-not-overlap-route":
        for (const tileId of targetIds) {
          const routes = getRoutesThroughTile(world, tileId).filter((route) =>
            requirement.routeType
              ? route.type === requirement.routeType
              : true,
          );

          if (routes.length > 0) {
            messages.push(`Target tile "${tileId}" overlaps an existing route.`);
          }
        }
        break;

      default: {
        const unreachable: never = requirement;
        messages.push(`Unsupported target requirement: ${String(unreachable)}`);
      }
    }
  }

  return messages;
}
