import { getTileId } from "../../world/coordinates";
import type { TileChange, WorldState } from "../../world/worldTypes";
import { cloneTile } from "../../world/tileUtils";
import { resolveNumber } from "../targeting/numbers";
import { manhattanDistance, sortTileIds } from "../targeting/utils";
import {
  candidateFromTile,
  resolveBoundary,
} from "./boundaries";
import {
  MAX_CREATED_TILES_PER_ACTION,
  MAX_PROPAGATION_STEPS,
} from "./constants";
import { toTargetResolutionContext } from "./contextBridge";
import {
  applyPropagationOperation,
  operationChangesTile,
} from "./operation";
import { canReplaceTile } from "./replacement";
import {
  chooseNextCandidate,
  collectNeighbourCoordinates,
  filterCandidatesForStrategy,
  getNeighbourMode,
  getNetworkTileSet,
  resolveStrategyDirectionSync,
} from "./strategies";
import { shouldStopBeforeEntering } from "./stopping";
import { calculateTraversalCost, validateTraversalDefinition } from "./traversal";
import type {
  FrontierCandidate,
  PropagatingEffectDefinition,
  PropagationContext,
  PropagationResult,
  PropagationStep,
} from "./types";

function cloneWorldTiles(world: WorldState): WorldState {
  return {
    ...world,
    tiles: Object.fromEntries(
      Object.entries(world.tiles).map(([tileId, tile]) => [tileId, cloneTile(tile)]),
    ),
  };
}

function buildTileChanges(
  originalWorld: WorldState,
  workingWorld: WorldState,
): TileChange[] {
  const changes: TileChange[] = [];
  const allTileIds = new Set([
    ...Object.keys(originalWorld.tiles),
    ...Object.keys(workingWorld.tiles),
  ]);

  for (const tileId of allTileIds) {
    const before = originalWorld.tiles[tileId] ?? null;
    const after = workingWorld.tiles[tileId];

    if (!after) {
      continue;
    }

    if (!before || JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push({
        tileId,
        before: before ? cloneTile(before) : null,
        after: cloneTile(after),
      });
    }
  }

  return changes.sort((left, right) =>
    left.tileId.localeCompare(right.tileId, undefined, { numeric: true }),
  );
}

export function propagateEffect(
  definition: PropagatingEffectDefinition,
  context: PropagationContext,
): PropagationResult {
  const resolvedValues: Record<string, unknown> = {
    ...context.resolvedTargetValues,
  };
  const validationMessages = [
    ...validateTraversalDefinition(definition.traversal),
  ];

  if (definition.operation.type === "add-overlay") {
    validationMessages.push("Overlay propagation is not supported yet.");
  }

  if (context.seedTileIds.length === 0) {
    validationMessages.push("Propagation requires at least one seed tile.");
  }

  const magnitudeResult = resolveNumber(
    definition.magnitude,
    toTargetResolutionContext(context),
    "propagation.magnitude",
    { minimum: 1, requirePositive: true },
  );

  if (magnitudeResult.error) {
    validationMessages.push(magnitudeResult.error);
  }

  Object.assign(resolvedValues, magnitudeResult.resolvedValues);

  const seedTileId = context.seedTileIds[0];
  const networkTiles = getNetworkTileSet(
    context.world,
    context.seedTileIds,
    definition.strategy.type === "follow-network"
      ? definition.strategy.routeType
      : undefined,
  );
  let resolvedDirection: string | undefined;

  if (seedTileId) {
    const directionResult = resolveStrategyDirectionSync(
      definition.strategy,
      context,
      seedTileId,
      resolvedValues,
    );

    if (directionResult.error) {
      validationMessages.push(directionResult.error);
    }

    resolvedDirection = directionResult.direction;
  }

  if (validationMessages.length > 0) {
    return {
      valid: false,
      seedTileIds: sortTileIds(context.seedTileIds),
      affectedTileIds: [],
      createdTileIds: [],
      traversedTileIds: [],
      blockedTileIds: [],
      steps: [],
      tileChanges: [],
      validationMessages,
      resolvedValues,
    };
  }

  const magnitude = magnitudeResult.value;
  const workingWorld = cloneWorldTiles(context.world);
  const seedTileIds = sortTileIds(context.seedTileIds);
  const primarySeedId = seedTileIds[0]!;

  const steps: PropagationStep[] = [];
  const affectedTileIds: string[] = [];
  const createdTileIds: string[] = [];
  const traversedTileIds: string[] = [];
  const blockedTileIds: string[] = [];
  const visitedExpansion = new Set<string>();
  const walkVisited = new Set<string>();
  let frontierTileIds = [...seedTileIds];
  let affectedCount = 0;
  let createdCount = 0;
  let stepSequence = 0;
  let walkCurrentTileId =
    definition.strategy.type === "random-walk" ? primarySeedId : undefined;

  if (definition.includeSeeds) {
    for (const seedId of seedTileIds) {
      const seedTile = workingWorld.tiles[seedId];

      if (!seedTile) {
        continue;
      }

      const replacement = canReplaceTile(
        seedTile,
        definition.operation,
        definition.replacement,
      );

      if (!replacement.allowed) {
        continue;
      }

      const after = applyPropagationOperation(
        seedTile,
        definition.operation,
        context.world.turn + 1,
      );

      if (operationChangesTile(seedTile, after)) {
        workingWorld.tiles[seedId] = after;
        affectedTileIds.push(seedId);
        affectedCount += 1;
        steps.push({
          sequence: stepSequence++,
          toCoordinate: { x: seedTile.x, y: seedTile.y },
          tileId: seedId,
          createdTile: false,
          traversalCost: 0,
          accumulatedCost: 0,
          applied: true,
        });
      }
    }
  }

  while (
    affectedCount < magnitude &&
    stepSequence < MAX_PROPAGATION_STEPS &&
    createdCount < MAX_CREATED_TILES_PER_ACTION
  ) {
    const expansionSources =
      definition.strategy.type === "random-walk"
        ? walkCurrentTileId
          ? [walkCurrentTileId]
          : []
        : frontierTileIds.filter((tileId) => workingWorld.tiles[tileId]);

    if (expansionSources.length === 0) {
      break;
    }

    const rawCandidates: FrontierCandidate[] = [];

    for (const fromTileId of expansionSources) {
      const neighbours = collectNeighbourCoordinates(
        workingWorld,
        fromTileId,
        getNeighbourMode(definition.strategy),
      );

      for (const coordinate of neighbours) {
        const distanceFromSeed = manhattanDistance(
          primarySeedId,
          getTileId(coordinate.x, coordinate.y),
        );

        let tile = workingWorld.tiles[getTileId(coordinate.x, coordinate.y)];
        let createdTile = false;

        if (!tile) {
          const boundary = resolveBoundary(
            workingWorld,
            coordinate,
            fromTileId,
            definition.boundary,
            context,
            definition.operation,
            createdCount,
            resolvedValues,
            definition.traversal,
            definition.resistance,
          );

          if (boundary.action === "stop") {
            blockedTileIds.push(getTileId(coordinate.x, coordinate.y));
            steps.push({
              sequence: stepSequence++,
              fromTileId,
              toCoordinate: coordinate,
              createdTile: false,
              traversalCost: Number.POSITIVE_INFINITY,
              accumulatedCost: Number.POSITIVE_INFINITY,
              applied: false,
              skippedReason: boundary.reason,
            });
            continue;
          }

          if (boundary.action === "discard") {
            continue;
          }

          if (boundary.action === "redirect" && boundary.tile) {
            tile = boundary.tile;
            coordinate.x = tile.x;
            coordinate.y = tile.y;
          } else if (boundary.action === "create") {
            tile = boundary.tile;
            workingWorld.tiles[tile.id] = cloneTile(tile);
            createdTile = true;
            createdCount += 1;
            createdTileIds.push(tile.id);
          }
        }

        const stop = shouldStopBeforeEntering(
          workingWorld,
          coordinate,
          tile,
          definition.stoppingConditions ?? [],
          context,
          primarySeedId,
          0,
          affectedCount,
          resolvedValues,
        );

        if (stop.blocked) {
          if (tile?.id) {
            blockedTileIds.push(tile.id);
          }

          steps.push({
            sequence: stepSequence++,
            fromTileId,
            toCoordinate: coordinate,
            tileId: tile?.id,
            createdTile,
            traversalCost: Number.POSITIVE_INFINITY,
            accumulatedCost: Number.POSITIVE_INFINITY,
            applied: false,
            skippedReason: stop.reason,
          });
          continue;
        }

        if (!tile) {
          continue;
        }

        const traversalCost = calculateTraversalCost(workingWorld, tile, {
          traversal: definition.traversal,
          resistance: definition.resistance,
          operation: definition.operation,
        });

        if (!Number.isFinite(traversalCost)) {
          blockedTileIds.push(tile.id);
          steps.push({
            sequence: stepSequence++,
            fromTileId,
            toCoordinate: coordinate,
            tileId: tile.id,
            createdTile,
            traversalCost,
            accumulatedCost: Number.POSITIVE_INFINITY,
            applied: false,
            skippedReason: "Traversal cost is impassable.",
          });
          continue;
        }

        rawCandidates.push(
          candidateFromTile(
            tile,
            fromTileId,
            traversalCost,
            traversalCost,
            distanceFromSeed,
            createdTile,
          ),
        );
      }
    }

    const candidates = filterCandidatesForStrategy(
      workingWorld,
      rawCandidates.filter((candidate) => {
        const candidateId =
          candidate.tileId ??
          getTileId(candidate.coordinate.x, candidate.coordinate.y);

        if (
          definition.strategy.type === "random-walk" &&
          definition.strategy.allowRevisit === false &&
          walkVisited.has(candidateId)
        ) {
          return false;
        }

        if (visitedExpansion.has(`${candidate.fromTileId}->${candidateId}`)) {
          return false;
        }

        return true;
      }),
      definition.strategy,
      context,
      resolvedValues,
      networkTiles,
      resolvedDirection,
    );

    const next = chooseNextCandidate(
      candidates,
      definition.strategy,
      context,
      stepSequence,
      resolvedValues,
    );

    if (!next?.tileId) {
      break;
    }

    visitedExpansion.add(`${next.fromTileId}->${next.tileId}`);
    const tile = workingWorld.tiles[next.tileId]!;

    const replacement = canReplaceTile(
      tile,
      definition.operation,
      definition.replacement,
    );

    let applied = false;
    let skippedReason = replacement.reason;

    if (replacement.allowed) {
      const after = applyPropagationOperation(
        tile,
        definition.operation,
        context.world.turn + 1,
      );

      if (operationChangesTile(tile, after)) {
        workingWorld.tiles[next.tileId] = after;
        affectedTileIds.push(next.tileId);
        affectedCount += 1;
        applied = true;
        skippedReason = undefined;
      } else {
        traversedTileIds.push(next.tileId);
        skippedReason = "Operation made no change.";
      }
    } else {
      traversedTileIds.push(next.tileId);
    }

    steps.push({
      sequence: stepSequence++,
      fromTileId: next.fromTileId,
      toCoordinate: { x: tile.x, y: tile.y },
      tileId: next.tileId,
      createdTile: next.createdTile,
      traversalCost: next.traversalCost,
      accumulatedCost: next.accumulatedCost,
      applied,
      skippedReason,
    });

    if (definition.strategy.type === "random-walk") {
      walkCurrentTileId = next.tileId;
      walkVisited.add(next.tileId);
    } else if (applied || replacement.allowed === false) {
      frontierTileIds = sortTileIds([
        ...new Set([...frontierTileIds, next.tileId]),
      ]);
    }
  }

  if (stepSequence >= MAX_PROPAGATION_STEPS) {
    validationMessages.push(
      `Propagation exceeded the safety limit of ${MAX_PROPAGATION_STEPS} steps.`,
    );
  }

  if (createdCount >= MAX_CREATED_TILES_PER_ACTION) {
    validationMessages.push(
      `Propagation exceeded the new tile limit of ${MAX_CREATED_TILES_PER_ACTION}.`,
    );
  }

  if (affectedCount < magnitude && validationMessages.length === 0) {
    validationMessages.push(
      `Propagation affected ${affectedCount} of ${magnitude} requested tiles.`,
    );
  }

  const tileChanges = buildTileChanges(context.world, workingWorld);

  return {
    valid: validationMessages.length === 0,
    seedTileIds,
    affectedTileIds: sortTileIds([...new Set(affectedTileIds)]),
    createdTileIds: sortTileIds([...new Set(createdTileIds)]),
    traversedTileIds: sortTileIds([...new Set(traversedTileIds)]),
    blockedTileIds: sortTileIds([...new Set(blockedTileIds)]),
    steps,
    tileChanges,
    validationMessages,
    resolvedValues,
  };
}

export function toPropagationRecord(
  result: PropagationResult,
  effectIndex: number,
): import("./types").PropagationRecord {
  return {
    effectIndex,
    seedTileIds: result.seedTileIds,
    affectedTileIds: result.affectedTileIds,
    createdTileIds: result.createdTileIds,
    blockedTileIds: result.blockedTileIds,
    steps: result.steps,
    resolvedValues: result.resolvedValues,
  };
}

export function isPropagatingEffect(
  effect: import("../../cards/cardTypes").EffectDefinition,
): effect is PropagatingEffectDefinition {
  return effect.type === "propagate";
}

export function getPropagatingEffects(
  effects: import("../../cards/cardTypes").EffectDefinition[],
): PropagatingEffectDefinition[] {
  return effects.filter(isPropagatingEffect);
}
