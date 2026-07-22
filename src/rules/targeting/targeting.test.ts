import { describe, expect, it } from "vitest";
import { cards } from "../../cards/cardDefinitions";
import {
  adjacentPrimaryTarget,
  connectedRegionTarget,
  distantFoundationsTarget,
  edgeOfTheKnownTarget,
  marchOfStoneTarget,
  nearestRoadTarget,
  ringOfAshTarget,
  singlePrimaryTileTarget,
} from "../../cards/cardTargets";
import type { CardDefinition } from "../../cards/cardTypes";
import { proposeAction } from "../engine";
import { buildTargetResolutionContext } from "../targets";
import { describeTargetDefinition } from "./describe";
import { applyTargetFilters } from "./filters";
import { resolveNumber } from "./numbers";
import { resolveDirection } from "./directions";
import { resolveTargets } from "./resolveTargets";
import { getTileId } from "../../world/coordinates";
import { createTestWorld } from "../../world/worldState";
import { normalizeMapTile, createVillageSettlement } from "../../world/tileUtils";
import type { WorldAction, WorldState } from "../../world/worldTypes";

function createCard(
  target: CardDefinition["target"],
  effects: CardDefinition["effects"] = [{ type: "set-terrain", terrain: "forest" }],
): CardDefinition {
  return {
    id: "targeting-test",
    name: "Targeting Test",
    description: "Test card",
    target,
    conditions: [],
    effects,
  };
}

function contextFor(
  world: WorldState,
  card: CardDefinition,
  primaryId?: string,
  secondaryId?: string,
  seed = "targeting-seed",
  previousAction?: WorldAction,
) {
  return buildTargetResolutionContext(
    world,
    card,
    {
      mode: primaryId && secondaryId ? "two-endpoints" : "single",
      tileIds: [primaryId, secondaryId].filter(Boolean) as string[],
      routeOriginTileId: primaryId,
      routeDestinationTileId: secondaryId,
    },
    seed,
    previousAction,
    [primaryId, secondaryId].filter(Boolean) as string[],
  );
}

describe("targeting origins", () => {
  it("resolves specific coordinates including negative values", () => {
    const world = createTestWorld("Test", 3, 3, -1, -1);
    const card = createCard({
      origin: { type: "specific-coordinate", x: -1, y: 0 },
      search: { type: "origin-only" },
      selection: { type: "first" },
    });
    const result = resolveTargets(card.target, contextFor(world, card));

    expect(result.originIds).toEqual(["-1,0"]);
  });

  it("resolves nearest settlement relative to world centre", () => {
    const world = createTestWorld("Test", 5, 5);
    world.tiles["0,0"] = normalizeMapTile({
      ...world.tiles["0,0"]!,
      settlement: createVillageSettlement("Far"),
    });
    world.tiles["2,2"] = normalizeMapTile({
      ...world.tiles["2,2"]!,
      settlement: createVillageSettlement("Near"),
    });

    const card = createCard({
      origin: { type: "nearest-settlement", settlementTier: "village" },
      search: { type: "origin-only" },
      selection: { type: "first" },
    });
    const result = resolveTargets(
      card.target,
      contextFor(world, card, "4,4"),
    );

    expect(result.originIds).toEqual(["2,2"]);
  });
});

describe("targeting searches", () => {
  it("returns four cardinal adjacent tiles", () => {
    const world = createTestWorld("Test", 5, 5);
    const card = createCard({
      origin: { type: "specific-coordinate", x: 2, y: 2 },
      search: { type: "adjacent", mode: "cardinal" },
      selection: { type: "all" },
    });
    const result = resolveTargets(card.target, contextFor(world, card));

    expect(result.filteredCandidateIds.sort()).toEqual(
      ["2,1", "2,2", "2,3", "1,2", "3,2"].sort(),
    );
  });

  it("creates a Chebyshev square perimeter at exact distance", () => {
    const world = createTestWorld("Test", 7, 7);
    const card = createCard({
      origin: { type: "specific-coordinate", x: 3, y: 3 },
      search: {
        type: "exact-distance",
        distance: { type: "fixed", value: 2 },
        metric: "chebyshev",
      },
      selection: { type: "all" },
    });
    const result = resolveTargets(card.target, contextFor(world, card));

    expect(result.filteredCandidateIds).toContain("1,1");
    expect(result.filteredCandidateIds).toContain("5,5");
    expect(result.filteredCandidateIds).not.toContain("3,3");
  });

  it("finds map boundary tiles", () => {
    const world = createTestWorld("Test", 4, 4);
    const card = createCard({
      origin: { type: "primary-selection" },
      search: { type: "map-boundary" },
      selection: { type: "all" },
    });
    const result = resolveTargets(
      card.target,
      contextFor(world, card, "1,1"),
    );

    expect(result.filteredCandidateIds.length).toBe(12);
    expect(result.filteredCandidateIds.every((id) => {
      const [x, y] = id.split(",").map(Number);
      return x === 0 || y === 0 || x === 3 || y === 3;
    })).toBe(true);
  });

  it("searches connected regions without crossing missing tiles", () => {
    const world = createTestWorld("Test", 4, 4);
    world.tiles["0,0"] = normalizeMapTile({
      ...world.tiles["0,0"]!,
      terrain: "forest",
    });
    world.tiles["1,0"] = normalizeMapTile({
      ...world.tiles["1,0"]!,
      terrain: "forest",
    });
    delete world.tiles["2,0"];

    const card = createCard(connectedRegionTarget("forest"));
    const result = resolveTargets(
      card.target,
      contextFor(world, card, "0,0"),
    );

    expect(result.filteredCandidateIds).toEqual(["0,0", "1,0"]);
  });
});

describe("targeting filters", () => {
  it("filters terrain, tags, and settlements", () => {
    const world = createTestWorld("Test", 3, 3);
    world.tiles["0,0"] = normalizeMapTile({
      ...world.tiles["0,0"]!,
      terrain: "water",
    });
    world.tiles["1,0"] = normalizeMapTile({
      ...world.tiles["1,0"]!,
      terrain: "grassland",
      tags: ["frontier"],
    });
    world.tiles["2,0"] = normalizeMapTile({
      ...world.tiles["2,0"]!,
      terrain: "grassland",
      settlement: createVillageSettlement(),
    });

    const filtered = applyTargetFilters(
      world,
      ["0,0", "1,0", "2,0"],
      [
        { type: "terrain-is-not", terrain: "water" },
        { type: "has-no-settlement" },
        { type: "has-tag", tag: "frontier" },
      ],
      { originTileId: "0,0" },
    );

    expect(filtered).toEqual(["1,0"]);
  });

  it("filters road connectivity relative to an origin endpoint", () => {
    const world = createTestWorld("Test", 3, 3);
    world.tiles["0,0"] = normalizeMapTile({
      ...world.tiles["0,0"]!,
      settlement: createVillageSettlement("Origin"),
    });
    world.tiles["1,0"] = normalizeMapTile({
      ...world.tiles["1,0"]!,
      settlement: createVillageSettlement("Target"),
    });

    expect(
      applyTargetFilters(
        world,
        ["1,0", "2,0"],
        [{ type: "is-not-connected-to-road" }],
        { originTileId: "0,0" },
      ),
    ).toEqual(["1,0", "2,0"]);
  });
});

describe("targeting ordering and selection", () => {
  it("orders by settlement tier and breaks ties by coordinate", () => {
    const world = createTestWorld("Test", 4, 4);
    world.tiles["0,0"] = normalizeMapTile({
      ...world.tiles["0,0"]!,
      settlement: createVillageSettlement("A"),
    });
    world.tiles["2,0"] = normalizeMapTile({
      ...world.tiles["2,0"]!,
      settlement: createVillageSettlement("B"),
    });

    const card = createCard({
      origin: { type: "primary-selection" },
      search: { type: "map-boundary" },
      ordering: { type: "lowest-settlement-tier" },
      selection: { type: "first" },
    });
    const result = resolveTargets(
      card.target,
      contextFor(world, card, "1,1"),
    );

    expect(result.selectedIds[0]).toBeDefined();
  });

  it("selects random targets deterministically", () => {
    const world = createTestWorld("Test", 5, 5);
    const card = createCard(distantFoundationsTarget());
    const first = resolveTargets(
      card.target,
      contextFor(world, card, "2,2", undefined, "random-seed"),
    );
    const second = resolveTargets(
      card.target,
      contextFor(world, card, "2,2", undefined, "random-seed"),
    );

    expect(first.selectedIds).toEqual(second.selectedIds);
  });
});

describe("targeting expansion", () => {
  it("deduplicates expanded targets", () => {
    const world = createTestWorld("Test", 5, 5);
    const card = createCard(ringOfAshTarget());
    const result = resolveTargets(
      card.target,
      contextFor(world, card, "2,2"),
    );

    expect(result.expandedTargetIds.length).toBe(
      new Set(result.expandedTargetIds).size,
    );
    expect(result.expandedTargetIds).not.toContain("2,2");
  });

  it("does not include missing coordinates during expansion", () => {
    const world = createTestWorld("Test", 3, 3);
    delete world.tiles["2,2"];

    const card = createCard(marchOfStoneTarget());
    const result = resolveTargets(
      card.target,
      contextFor(world, card, "0,0", undefined, "line-seed"),
    );

    expect(
      result.expandedTargetIds.every((tileId) => Boolean(world.tiles[tileId])),
    ).toBe(true);
    expect(result.expandedTargetIds.length).toBeLessThan(5);
  });
});

describe("targeting numbers and directions", () => {
  it("rejects invalid random ranges", () => {
    const world = createTestWorld("Test", 2, 2);
    const card = createCard(singlePrimaryTileTarget());
    const result = resolveNumber(
      { type: "random-range", minimum: 5, maximum: 2 },
      contextFor(world, card, "0,0"),
      "distance",
    );

    expect(result.error).toBeDefined();
  });

  it("resolves toward-world-centre direction deterministically", () => {
    const world = createTestWorld("Test", 5, 5);
    const first = resolveDirection(
      { type: "toward-world-centre" },
      contextFor(world, createCard(singlePrimaryTileTarget()), "4,4"),
      "4,4",
      "dir-seed",
    );
    const second = resolveDirection(
      { type: "toward-world-centre" },
      contextFor(world, createCard(singlePrimaryTileTarget()), "4,4"),
      "4,4",
      "dir-seed",
    );

    expect(first.direction).toBe(second.direction);
  });
});

describe("targeting requirements", () => {
  it("validates minimum and maximum target counts", () => {
    const world = createTestWorld("Test", 2, 2);
    const card = createCard({
      origin: { type: "primary-selection" },
      search: { type: "origin-only" },
      selection: { type: "first" },
      requirements: [
        { type: "minimum-target-count", count: 2 },
        { type: "maximum-target-count", count: 1 },
      ],
    });
    const result = resolveTargets(
      card.target,
      contextFor(world, card, "0,0"),
    );

    expect(result.valid).toBe(false);
    expect(result.validationMessages.length).toBeGreaterThan(0);
  });
});

describe("targeting integration", () => {
  it("describes target definitions in plain language", () => {
    const description = describeTargetDefinition(edgeOfTheKnownTarget());

    expect(description).toMatch(/boundary/i);
  });

  it("previews demonstration cards deterministically", () => {
    const world = createTestWorld("Test", 6, 6);
    world.tiles["2,2"] = normalizeMapTile({
      ...world.tiles["2,2"]!,
      terrain: "grassland",
    });

    const ringCard = cards.find((entry) => entry.id === "ring-of-ash")!;
    const first = proposeAction(world, ringCard, ["2,2"], "demo-seed");
    const second = proposeAction(world, ringCard, ["2,2"], "demo-seed");

    expect(first.targetResolution).toEqual(second.targetResolution);
    expect(first.targetResolution?.expandedTargetIds.length).toBeGreaterThan(0);
  });

  it("resolves nearest road card targets from a selected village", () => {
    const world = createTestWorld("Test", 6, 6);
    world.tiles["1,1"] = normalizeMapTile({
      ...world.tiles["1,1"]!,
      terrain: "grassland",
      settlement: createVillageSettlement("Origin"),
    });
    world.tiles["4,1"] = normalizeMapTile({
      ...world.tiles["4,1"]!,
      terrain: "grassland",
      settlement: createVillageSettlement("Target"),
    });

    const card = createCard(nearestRoadTarget(), [
      {
        type: "create-travel-route",
        routeType: "road",
        destination: { type: "selected-secondary-target" },
        allowedNodeTypes: ["village", "settlement-region"],
      },
    ]);
    const preview = proposeAction(world, card, ["1,1"], "road-seed");

    expect(preview.valid).toBe(true);
    expect(preview.targetResolution?.originIds).toEqual(["1,1"]);
    expect(preview.targetResolution?.selectedIds[0]).not.toBe("1,1");
  });

  it("contains no Leaflet imports in targeting modules", async () => {
    const modules = import.meta.glob("./targeting/**/*.ts");
    const leafletPattern = /from [\"']leaflet[\"']/;

    for (const loadModule of Object.values(modules)) {
      const source = await loadModule();
      expect(JSON.stringify(source)).not.toMatch(leafletPattern);
    }
  });
});

describe("targeting preview tiles", () => {
  it("uses expanded targets for edge of the known card", () => {
    const world = createTestWorld("Test", 5, 5);
    const card = cards.find((entry) => entry.id === "edge-of-the-known")!;
    const preview = proposeAction(world, card, ["2,2"], "edge-seed");

    expect(preview.valid).toBe(true);
    expect(preview.targetResolution?.expandedTargetIds).toHaveLength(1);
    expect(getTileId(0, 2)).not.toBe(preview.targetResolution?.expandedTargetIds[0]);
  });
});
