import { describe, expect, it, vi } from "vitest";
import { cards } from "../cards/cardDefinitions";
import { drawRandomCard } from "../cards/drawCard";
import { getTileId } from "../world/coordinates";
import { createTestWorld } from "../world/worldState";
import {
  normalizeMapTile,
} from "../world/tileUtils";
import { proposeAction } from "../rules/engine";
import { commitWorldAction } from "../world/commitWorldAction";
import * as persistCommittedWorldModule from "../persistence/persistCommittedWorld";
import { parseWorld, serializeWorld } from "../persistence/worldMigration";
import { applyWorldLaws } from "./applyWorldLaws";
import { groupConnectedUnits } from "./groupConnectedUnits";
import { createRegionId } from "./regionId";
import { findRuinClusters } from "./ruinClusters";
import { buildSettlementHierarchy } from "./settlementHierarchy";
import { applyVillageDecline } from "./villageDecline";
import type { WorldState } from "../world/worldTypes";
import { isRuinSettlement, isVillageSettlement } from "../world/worldTypes";

function setTile(
  world: WorldState,
  x: number,
  y: number,
  patch: Partial<ReturnType<typeof normalizeMapTile>>,
): WorldState {
  const id = getTileId(x, y);
  const existing = world.tiles[id] ?? normalizeMapTile({ id, x, y, terrain: "empty", tags: [], properties: {} });

  return {
    ...world,
    tiles: {
      ...world.tiles,
      [id]: normalizeMapTile({ ...existing, ...patch, id, x, y }),
    },
  };
}

function addVillage(
  world: WorldState,
  x: number,
  y: number,
  inhospitableTurns = 0,
  terrain: "empty" | "desert" | "grassland" = "grassland",
): WorldState {
  return setTile(world, x, y, {
    terrain,
    settlement: { type: "village", inhospitableTurns },
  });
}

function lineVillages(world: WorldState, count: number, y = 0): WorldState {
  let next = world;

  for (let x = 0; x < count; x++) {
    next = addVillage(next, x, y);
  }

  return next;
}

describe("turn behaviour", () => {
  it("increments the turn once per committed card", async () => {
    const world = addVillage(createTestWorld("Turn", 3, 3), 1, 1);
    const card = cards.find((entry) => entry.id === "wild-growth")!;
    const proposal = proposeAction(world, card, ["1,1"], "seed-turn");
    const saveSpy = vi
      .spyOn(persistCommittedWorldModule, "persistCommittedWorld")
      .mockResolvedValue(undefined);

    const result = await commitWorldAction(
      world,
      card,
      ["1,1"],
      proposal.randomSeed,
      proposal,
    );

    expect(result.world.turn).toBe(1);
    expect(result.action.turn).toBe(1);
    saveSpy.mockRestore();
  });

  it("does not become a ruin before the threshold", () => {
    const world = addVillage(createTestWorld("Almost", 2, 2), 0, 0, 1, "empty");
    const result = applyVillageDecline(world, 2);
    expect(isVillageSettlement(result.tiles["0,0"]?.settlement)).toBe(true);
  });

  it("forms higher tiers at configured thresholds", () => {
    const world = lineVillages(createTestWorld("Tiers", 30, 5), 15);
    const regions = buildSettlementHierarchy(world, 0);
    expect(Object.values(regions).filter((r) => r.tier === "town")).toHaveLength(5);
    expect(Object.values(regions).filter((r) => r.tier === "expanse")).toHaveLength(1);
  });

  it("does not increment the turn when discarding", () => {
    const world = createTestWorld("Turn", 3, 3);
    drawRandomCard();
    expect(world.turn).toBe(0);
  });

  it("does not increment the turn on failed validation", () => {
    const world = createTestWorld("Turn", 3, 3);
    world.tiles["1,1"] = normalizeMapTile({
      ...world.tiles["1,1"]!,
      terrain: "water",
    });
    const card = cards.find((entry) => entry.id === "new-foundations")!;
    const proposal = proposeAction(world, card, ["1,1"], "seed-invalid");
    expect(proposal.valid).toBe(false);
    expect(proposal.nextTurn).toBe(0);
  });

  it("does not increment the turn when persistence fails", async () => {
    const world = addVillage(createTestWorld("Turn", 3, 3), 1, 1, 0, "grassland");
    const card = cards.find((entry) => entry.id === "wild-growth")!;
    const proposal = proposeAction(world, card, ["1,1"], "seed-save");
    vi.spyOn(persistCommittedWorldModule, "persistCommittedWorld").mockRejectedValue(
      new Error("save failed"),
    );

    await expect(
      commitWorldAction(world, card, ["1,1"], proposal.randomSeed, proposal),
    ).rejects.toThrow();
    expect(world.turn).toBe(0);
  });
});

describe("village decline", () => {
  it("advances decline on empty and desert terrain and resets on grassland", () => {
    const emptyVillage = addVillage(createTestWorld("Decline", 4, 2), 0, 0, 0, "empty");
    const desertVillage = addVillage(emptyVillage, 1, 0, 0, "desert");
    const grassVillage = addVillage(desertVillage, 2, 0, 2, "grassland");

    const result = applyVillageDecline(grassVillage, 1);

    expect(result.tiles["0,0"]?.settlement).toMatchObject({
      type: "village",
      inhospitableTurns: 1,
    });
    expect(result.tiles["1,0"]?.settlement).toMatchObject({
      type: "village",
      inhospitableTurns: 1,
    });
    expect(result.tiles["2,0"]?.settlement).toMatchObject({
      type: "village",
      inhospitableTurns: 0,
    });
  });

  it("becomes a ruin at the threshold and keeps terrain plus ruined tag", () => {
    const world = addVillage(createTestWorld("Ruin", 2, 2), 0, 0, 2, "empty");
    const result = applyVillageDecline(world, 3);
    const tile = result.tiles["0,0"]!;

    expect(isRuinSettlement(tile.settlement)).toBe(true);
    expect(tile.terrain).toBe("empty");
    expect(tile.tags).toContain("ruined");
  });

  it("does not apply decline logic to ruins", () => {
    let world = addVillage(createTestWorld("Ruin", 2, 2), 0, 0, 2, "empty");
    const firstPass = applyVillageDecline(world, 3);
    world = { ...world, tiles: firstPass.tiles };
    const ruinTile = world.tiles["0,0"]!;
    expect(isRuinSettlement(ruinTile.settlement)).toBe(true);

    const secondPass = applyVillageDecline(world, 4);
    expect(isRuinSettlement(secondPass.tiles["0,0"]?.settlement)).toBe(true);
    expect(secondPass.consequences).toHaveLength(0);
  });
});

describe("settlement hierarchy", () => {
  it("forms towns only at the configured thresholds", () => {
    const twoVillages = buildSettlementHierarchy(lineVillages(createTestWorld("H", 5, 3), 2), 0);
    expect(Object.values(twoVillages).filter((r) => r.tier === "town")).toHaveLength(0);

    const threeVillages = buildSettlementHierarchy(lineVillages(createTestWorld("H", 5, 3), 3), 0);
    expect(Object.values(threeVillages).filter((r) => r.tier === "town")).toHaveLength(1);

    const fourVillages = buildSettlementHierarchy(lineVillages(createTestWorld("H", 5, 3), 4), 0);
    expect(Object.values(fourVillages).filter((r) => r.tier === "town")).toHaveLength(1);

    const sixVillages = buildSettlementHierarchy(lineVillages(createTestWorld("H", 8, 3), 6), 0);
    expect(Object.values(sixVillages).filter((r) => r.tier === "town")).toHaveLength(2);
  });

  it("does not connect diagonal-only villages in cardinal mode", () => {
    let world = createTestWorld("Diag", 3, 3);
    world = addVillage(world, 0, 0);
    world = addVillage(world, 1, 1);
    world = addVillage(world, 2, 2);

    const regions = buildSettlementHierarchy(world, 0);
    expect(Object.values(regions).filter((r) => r.tier === "town")).toHaveLength(0);
  });

  it("cascades higher tiers using connected child regions", () => {
    let world = createTestWorld("Cascade", 30, 3);
    world = lineVillages(world, 15);
    const regions = buildSettlementHierarchy(world, 0);

    expect(Object.values(regions).filter((r) => r.tier === "town")).toHaveLength(5);
    expect(Object.values(regions).filter((r) => r.tier === "expanse")).toHaveLength(1);
  });

  it("keeps grouping deterministic", () => {
    let world = createTestWorld("Deterministic", 8, 3);
    world = lineVillages(world, 6);

    const first = buildSettlementHierarchy(world, 0);
    const second = buildSettlementHierarchy(world, 0);

    expect(first).toEqual(second);
  });

  it("supports negative coordinates", () => {
    let world = createTestWorld("Negative", 6, 3, -2, -1);
    world = addVillage(world, -2, -1);
    world = addVillage(world, -1, -1);
    world = addVillage(world, 0, -1);

    const regions = buildSettlementHierarchy(world, 0);
    expect(Object.values(regions).filter((r) => r.tier === "town")).toHaveLength(1);
  });

  it("assigns each child to at most one parent", () => {
    let world = lineVillages(createTestWorld("Parents", 10, 3), 6);
    const regions = buildSettlementHierarchy(world, 0);
    const towns = Object.values(regions).filter((r) => r.tier === "town");
    const assigned = new Set<string>();

    for (const town of towns) {
      for (const childId of town.childIds) {
        expect(assigned.has(childId)).toBe(false);
        assigned.add(childId);
      }
    }
  });

  it("uses stable region IDs for unchanged compositions", () => {
    let world = lineVillages(createTestWorld("Ids", 5, 3), 3);
    const first = buildSettlementHierarchy(world, 0);
    const second = buildSettlementHierarchy(world, 0);
    const firstTown = Object.values(first).find((r) => r.tier === "town")!;
    const secondTown = Object.values(second).find((r) => r.tier === "town")!;
    expect(firstTown.id).toBe(secondTown.id);
  });

  it("changes region IDs when membership changes", () => {
    let world = lineVillages(createTestWorld("Ids", 6, 3), 3);
    const firstTown = Object.values(buildSettlementHierarchy(world, 0)).find(
      (r) => r.tier === "town",
    )!;
    world = setTile(world, 0, 0, { settlement: undefined });
    const nextRegions = buildSettlementHierarchy(world, 0);
    expect(nextRegions[firstTown.id]).toBeUndefined();
  });
});

describe("hierarchy reduction", () => {
  it("dissolves towns when eligible villages drop below the threshold", () => {
    let world = lineVillages(createTestWorld("Dissolve", 5, 3), 3);
    const previous = buildSettlementHierarchy(world, 0);
    world = setTile(world, 0, 0, {
      settlement: { type: "ruin", formerType: "village", ruinedAtTurn: 1 },
      tags: ["ruined"],
    });
    const lawResult = applyWorldLaws(
      { ...world, settlementRegions: previous },
      world,
      1,
    );

    expect(Object.values(lawResult.world.settlementRegions).some((r) => r.tier === "town")).toBe(
      false,
    );
    expect(
      lawResult.consequences.some((c) => c.type === "settlement-region-dissolved"),
    ).toBe(true);
  });
});

describe("ruin groups", () => {
  function addRuin(world: WorldState, x: number, y: number): WorldState {
    return setTile(world, x, y, {
      terrain: "empty",
      settlement: { type: "ruin", formerType: "village", ruinedAtTurn: 1 },
      tags: ["ruined"],
    });
  }

  it("groups adjacent ruins and keeps separated ruins apart", () => {
    let world = createTestWorld("Ruins", 6, 3);
    world = addRuin(world, 0, 0);
    world = addRuin(world, 1, 0);
    world = addRuin(world, 3, 0);

    const clusters = findRuinClusters(world);
    expect(clusters).toHaveLength(2);
    expect(clusters[0]).toHaveLength(2);
    expect(clusters[1]).toHaveLength(1);
  });

  it("keeps diagonal-only ruins separate in cardinal mode", () => {
    let world = createTestWorld("Ruins", 3, 3);
    world = addRuin(world, 0, 0);
    world = addRuin(world, 1, 1);

    expect(findRuinClusters(world)).toHaveLength(2);
  });
});

describe("preview and commit", () => {
  it("includes automatic consequences in preview and commit", async () => {
    let world = lineVillages(createTestWorld("Preview", 5, 3), 2);
    world = {
      ...world,
      settlementRegions: buildSettlementHierarchy(world, 0),
    };

    const card = cards.find((entry) => entry.id === "new-foundations")!;
    const proposal = proposeAction(world, card, ["2,0"], "seed-preview");
    expect(proposal.valid).toBe(true);
    expect(proposal.consequences.some((c) => c.type === "settlement-region-formed")).toBe(
      true,
    );

    const saveSpy = vi
      .spyOn(persistCommittedWorldModule, "persistCommittedWorld")
      .mockResolvedValue(undefined);
    const committed = await commitWorldAction(
      world,
      card,
      ["2,0"],
      proposal.randomSeed,
      proposal,
    );
    expect(committed.action.consequences).toEqual(proposal.consequences);
    saveSpy.mockRestore();
  });

  it("round-trips turn, regions, ruins, and consequences through export/import", () => {
    let world = lineVillages(createTestWorld("Export", 5, 3), 3);
    world = addVillage(world, 3, 0, 2, "empty");
    const lawResult = applyWorldLaws(world, world, 1);
    const enriched: WorldState = {
      ...lawResult.world,
      turn: 1,
      history: [
        {
          id: "action-1",
          sequence: 1,
          cardId: "wild-growth",
          cardName: "The Wild Returns",
          targetIds: ["1,1"],
          appliedAt: new Date(0).toISOString(),
          changes: lawResult.tileChanges,
          randomSeed: "seed-export",
          resolvedValues: {},
          turn: 1,
          consequences: lawResult.consequences,
          regionChanges: lawResult.regionChanges,
          routeChanges: [],
        },
      ],
    };

    const parsed = parseWorld(serializeWorld(enriched));
    expect(parsed.turn).toBe(1);
    expect(parsed.settlementRegions).toEqual(enriched.settlementRegions);
    expect(parsed.history[0]?.consequences).toEqual(enriched.history[0]?.consequences);
    expect(
      Object.values(parsed.tiles).some((tile) => isRuinSettlement(tile.settlement)),
    ).toBe(true);
  });
});

describe("groupConnectedUnits", () => {
  it("creates only exact-threshold groups", () => {
    const units = ["a", "b", "c", "d"];
    const groups = groupConnectedUnits(
      units,
      3,
      (unit) => unit,
      (left, right) => Math.abs(units.indexOf(left) - units.indexOf(right)) === 1,
    );

    expect(groups).toEqual([["a", "b", "c"]]);
  });
});

describe("createRegionId", () => {
  it("is stable for the same children", () => {
    expect(createRegionId("town", ["2,0", "1,0", "0,0"])).toBe(
      createRegionId("town", ["0,0", "1,0", "2,0"]),
    );
  });
});
