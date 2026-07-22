import { describe, expect, it, vi } from "vitest";
import { cards } from "../cards/cardDefinitions";
import { getTileId } from "../world/coordinates";
import { createTestWorld } from "../world/worldState";
import { normalizeMapTile } from "../world/tileUtils";
import { evaluateCondition, evaluateConditions } from "./conditions";
import { proposeAction } from "./engine";
import { applyEffectsToTile } from "./effects";
import { createSeededRandom, pickRandomItems } from "./random";
import { resolveCardTargets } from "./targets";
import { commitWorldAction } from "../world/commitWorldAction";
import * as worldStorage from "../persistence/worldStorage";

describe("conditions", () => {
  const world = createTestWorld("Test", 3, 3);

  it("accepts valid targets", () => {
    const tile = world.tiles["1,1"]!;

    expect(
      evaluateConditions(world, tile, [{ type: "terrain-is-not", terrain: "water" }])
        .valid,
    ).toBe(true);
  });

  it("rejects invalid targets", () => {
    const flooded = createTestWorld("Test", 2, 2);
    flooded.tiles["0,0"] = normalizeMapTile({
      ...flooded.tiles["0,0"]!,
      terrain: "water",
    });

    expect(
      evaluateConditions(flooded, flooded.tiles["0,0"]!, [
        { type: "has-no-settlement" },
        { type: "terrain-is-not", terrain: "water" },
      ]).valid,
    ).toBe(false);
  });

  it("checks adjacent terrain", () => {
    const worldWithWater = createTestWorld("Test", 3, 3);
    worldWithWater.tiles["1,0"] = normalizeMapTile({
      ...worldWithWater.tiles["1,0"]!,
      terrain: "water",
    });

    expect(
      evaluateCondition(worldWithWater, worldWithWater.tiles["1,1"]!, {
        type: "adjacent-to-terrain",
        terrain: "water",
      }),
    ).toBe(true);
  });
});

describe("targets", () => {
  const world = createTestWorld("Test", 4, 4);

  it("resolves a single tile target", () => {
    expect(
      resolveCardTargets(world, { type: "single-tile" }, ["2,2"]),
    ).toEqual({
      ok: true,
      targetIds: ["2,2"],
    });
  });

  it("keeps adjacent targeting within map bounds", () => {
    const result = resolveCardTargets(
      world,
      { type: "adjacent-tiles", radius: 1 },
      ["0,0"],
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.targetIds.sort()).toEqual(["0,0", "0,1", "1,0"].sort());
      expect(result.targetIds).not.toContain(getTileId(-1, 0));
    }
  });
});

describe("effects", () => {
  it("produces immutable updates", () => {
    const world = createTestWorld("Test", 2, 2);
    const before = world.tiles["0,0"]!;

    const modified = applyEffectsToTile(
      world,
      before,
      [{ type: "set-terrain", terrain: "forest" }],
      "seed-1",
      {},
    );

    expect(modified["0,0"]?.terrain).toBe("forest");
    expect(world.tiles["0,0"]?.terrain).toBe("empty");
    expect(before.terrain).toBe("empty");
  });
});

describe("engine", () => {
  it("matches preview and committed results", () => {
    vi.spyOn(worldStorage, "saveWorld").mockImplementation(() => undefined);

    const world = createTestWorld("Test", 3, 3);
    const card = cards.find((entry) => entry.id === "wild-growth")!;
    const preview = proposeAction(world, card, ["1,1"], "fixed-seed");
    const committed = commitWorldAction(
      world,
      card,
      ["1,1"],
      preview.randomSeed,
      preview,
    );

    expect(preview.valid).toBe(true);
    expect(committed.world.tiles["1,1"]?.terrain).toBe("forest");
    expect(committed.action.changes).toEqual([
      ...preview.cardChanges,
      ...preview.consequenceChanges,
    ]);
    expect(committed.action.randomSeed).toBe("fixed-seed");
    expect(committed.world.history).toHaveLength(1);
  });

  it("uses seeded randomness for neighbouring terrain effects", () => {
    const world = createTestWorld("Test", 3, 3);
    const card = {
      id: "test-random",
      name: "Random Spread",
      description: "Test",
      target: { type: "single-tile" as const },
      conditions: [],
      effects: [
        {
          type: "change-neighbouring-terrain" as const,
          terrain: "forest" as const,
          count: 2,
        },
      ],
    };

    const first = proposeAction(world, card, ["1,1"], "repeatable-seed");
    const second = proposeAction(world, card, ["1,1"], "repeatable-seed");

    expect(first).toEqual(second);
    expect(first.resolvedValues).not.toEqual({});
  });

  it("creates exactly one history action per commit", () => {
    vi.spyOn(worldStorage, "saveWorld").mockImplementation(() => undefined);

    const world = createTestWorld("Test", 2, 2);
    const card = cards.find((entry) => entry.id === "waters-rise")!;
    const preview = proposeAction(world, card, ["0,0"], "seed-a");
    const committed = commitWorldAction(
      world,
      card,
      ["0,0"],
      preview.randomSeed,
      preview,
    );

    expect(committed.world.history).toHaveLength(1);
    expect(committed.action.sequence).toBe(1);
  });

  it("previews regional forest spread without affecting water tiles", () => {
    const world = createTestWorld("Test", 3, 3);
    world.tiles["1,1"] = normalizeMapTile({
      ...world.tiles["1,1"]!,
      terrain: "water",
    });

    const card = cards.find((entry) => entry.id === "creeping-wilds")!;
    const preview = proposeAction(world, card, ["1,1"], "regional-seed");

    expect(preview.valid).toBe(true);
    expect(preview.cardChanges.some((change) => change.after.terrain === "water")).toBe(
      false,
    );
    expect(preview.cardChanges.length).toBeGreaterThan(0);
  });
});

describe("random", () => {
  it("picks repeatable items from a seed", () => {
    const items = ["a", "b", "c", "d"];
    const first = pickRandomItems(items, 2, createSeededRandom("seed"));
    const second = pickRandomItems(items, 2, createSeededRandom("seed"));

    expect(first).toEqual(second);
  });
});
