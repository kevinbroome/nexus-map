import { describe, expect, it, vi } from "vitest";
import { applyCardToTile, proposeCardChanges } from "./applyCard";
import { cards } from "./cardDefinitions";
import { validateCardApplication } from "./validateCard";
import { createWorld } from "../world/worldState";
import { commitWorldAction } from "../world/commitWorldAction";
import {
  parseWorld,
  serializeWorld,
  worldsAreEqual,
} from "../persistence/worldMigration";
import * as worldStorage from "../persistence/worldStorage";

describe("applyCardToTile", () => {
  it("sets terrain on a tile", () => {
    const world = createWorld("Test", 2, 2);
    const waterCard = cards.find((card) => card.id === "waters-rise")!;

    const updated = applyCardToTile(world, waterCard, "1,1");

    expect(updated.tiles["1,1"]?.terrain).toBe("water");
    expect(updated.tiles).not.toBe(world.tiles);
  });

  it("removes a settlement when terrain becomes water", () => {
    const world = createWorld("Test", 2, 2);
    const villageCard = cards.find((card) => card.id === "new-foundations")!;
    const waterCard = cards.find((card) => card.id === "waters-rise")!;

    const withVillage = applyCardToTile(world, villageCard, "0,0");
    const flooded = applyCardToTile(withVillage, waterCard, "0,0");

    expect(flooded.tiles["0,0"]?.terrain).toBe("water");
    expect(flooded.tiles["0,0"]?.settlement).toBeUndefined();
  });

  it("throws when adding a settlement to water", () => {
    const world = createWorld("Test", 2, 2);
    const waterCard = cards.find((card) => card.id === "waters-rise")!;
    const villageCard = cards.find((card) => card.id === "new-foundations")!;

    const flooded = applyCardToTile(world, waterCard, "0,0");

    expect(() => applyCardToTile(flooded, villageCard, "0,0")).toThrow(
      "A settlement cannot be created on water.",
    );
  });
});

describe("proposeCardChanges", () => {
  it("returns before and after snapshots without mutating the world", () => {
    const world = createWorld("Test", 2, 2);
    const forestCard = cards.find((card) => card.id === "wild-growth")!;

    const changes = proposeCardChanges(world, forestCard, ["1,1"]);

    expect(changes).toEqual([
      {
        tileId: "1,1",
        before: world.tiles["1,1"],
        after: {
          ...world.tiles["1,1"]!,
          terrain: "forest",
        },
      },
    ]);
    expect(world.tiles["1,1"]?.terrain).toBe("empty");
  });
});

describe("validateCardApplication", () => {
  it("requires a selected tile", () => {
    const world = createWorld("Test", 2, 2);
    const card = cards[0]!;

    expect(validateCardApplication(world, card, [])).toEqual({
      valid: false,
      message: "Select a tile first.",
    });
  });

  it("rejects multiple selected tiles", () => {
    const world = createWorld("Test", 2, 2);
    const card = cards[0]!;

    expect(validateCardApplication(world, card, ["0,0", "1,0"])).toEqual({
      valid: false,
      message: "Cards currently require exactly one selected tile.",
    });
  });

  it("rejects settlements on water before apply", () => {
    const world = createWorld("Test", 2, 2);
    const waterCard = cards.find((card) => card.id === "waters-rise")!;
    const villageCard = cards.find((card) => card.id === "new-foundations")!;

    const flooded = applyCardToTile(world, waterCard, "0,0");

    expect(validateCardApplication(flooded, villageCard, ["0,0"])).toEqual({
      valid: false,
      message: "A settlement cannot be created on water.",
    });
  });
});

describe("commitWorldAction", () => {
  it("persists an append-only action with sequence numbers", () => {
    const saveSpy = vi
      .spyOn(worldStorage, "saveWorld")
      .mockImplementation(() => undefined);
    const world = createWorld("Test", 2, 2);
    const forestCard = cards.find((card) => card.id === "wild-growth")!;

    const result = commitWorldAction(world, forestCard, ["1,1"]);

    expect(result.world.tiles["1,1"]?.terrain).toBe("forest");
    expect(result.action.sequence).toBe(1);
    expect(result.action.cardName).toBe("The Wild Returns");
    expect(result.action.changes[0]?.before.terrain).toBe("empty");
    expect(result.action.changes[0]?.after.terrain).toBe("forest");
    expect(result.message).toContain('Applied "The Wild Returns" to tile 1,1.');
    expect(result.message).toContain("World saved. Action #1.");
    expect(saveSpy).toHaveBeenCalledWith(result.world);
  });

  it("does not commit when persistence fails", () => {
    vi.spyOn(worldStorage, "saveWorld").mockImplementation(() => {
      throw new Error("The world could not be saved.");
    });

    const world = createWorld("Test", 2, 2);
    const forestCard = cards.find((card) => card.id === "wild-growth")!;

    expect(() => commitWorldAction(world, forestCard, ["1,1"])).toThrow(
      "The action could not be saved. The world was not changed.",
    );
  });
});

describe("world persistence format", () => {
  it("round-trips a versioned world through JSON", () => {
    vi.spyOn(worldStorage, "saveWorld").mockImplementation(() => undefined);
    const world = createWorld("Round Trip", 3, 2);
    const forestCard = cards.find((card) => card.id === "wild-growth")!;
    const committed = commitWorldAction(world, forestCard, ["2,1"]).world;

    const parsed = parseWorld(serializeWorld(committed));

    expect(worldsAreEqual(committed, parsed)).toBe(true);
    expect(parsed.version).toBe(1);
    expect(parsed.history[0]?.sequence).toBe(1);
  });

  it("rejects unsupported versions", () => {
    const invalid = {
      version: 99,
      id: "bad",
      name: "Bad",
      width: 1,
      height: 1,
      tiles: {},
      history: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    expect(() => parseWorld(JSON.stringify(invalid))).toThrow(
      "Unsupported world version: 99",
    );
  });

  it("rejects saves without a version field", () => {
    const legacy = {
      id: "legacy-id",
      name: "Legacy World",
      width: 2,
      height: 2,
      tiles: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    expect(() => parseWorld(JSON.stringify(legacy))).toThrow(
      "The saved world is missing a version field.",
    );
  });
});
