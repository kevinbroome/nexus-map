import { describe, expect, it } from "vitest";
import { getRenderableTileIds } from "../map/mapBounds";
import { parseWorld, serializeWorld } from "../persistence/worldMigration";
import {
  getTileId,
  parseTileId,
  tileExists,
  getTileAt,
} from "./coordinates";
import { getWorldBounds, getWorldBoundsOrDefault } from "./bounds";
import {
  createTile,
  getMissingCardinalNeighbours,
  isBoundaryTile,
} from "./tileCreation";
import { normalizeMapTile } from "./tileUtils";
import { createTestWorld } from "./worldState";
import type { LegacyWorldStateV1, WorldState } from "./worldTypes";

function createSparseWorld(
  tiles: Array<{ x: number; y: number; terrain?: "empty" | "chasm" | "water" }>,
): WorldState {
  let world = createTestWorld("Sparse", 0, 0);

  for (const tile of tiles) {
    world = createTile(world, { x: tile.x, y: tile.y }, tile.terrain ?? "empty");
  }

  return world;
}

describe("coordinates", () => {
  it("supports negative coordinates in tile IDs", () => {
    expect(getTileId(-3, -7)).toBe("-3,-7");
    expect(parseTileId("-3,-7")).toEqual({ x: -3, y: -7 });
  });
});

describe("getWorldBounds", () => {
  it("returns null for an empty world", () => {
    const world = createTestWorld("Empty", 0, 0);

    expect(getWorldBounds(world)).toBeNull();
    expect(getWorldBoundsOrDefault(world)).toEqual({
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    });
  });

  it("calculates bounds from existing tiles", () => {
    const world = createSparseWorld([
      { x: 1, y: 2 },
      { x: -1, y: 0 },
      { x: 3, y: -2 },
    ]);

    expect(getWorldBounds(world)).toEqual({
      minX: -1,
      maxX: 3,
      minY: -2,
      maxY: 2,
    });
  });

  it("updates when tiles are added outside the original area", () => {
    const world = createTestWorld("Patch", 2, 2);
    const expanded = createTile(world, { x: 5, y: -1 }, "empty");

    expect(getWorldBounds(expanded)).toEqual({
      minX: 0,
      maxX: 5,
      minY: -1,
      maxY: 1,
    });
  });
});

describe("createTile", () => {
  it("rejects duplicate coordinates", () => {
    const world = createTestWorld("Patch", 1, 1);

    expect(() => createTile(world, { x: 0, y: 0 }, "empty")).toThrow(
      /already exists/i,
    );
  });

  it("initialises tags and properties", () => {
    const world = createTestWorld("Patch", 1, 1);
    const updated = createTile(world, { x: 1, y: 0 }, "empty");
    const tile = updated.tiles["1,0"];

    expect(tile?.tags).toEqual([]);
    expect(tile?.properties).toEqual({});
  });

  it("does not mutate the original world", () => {
    const world = createTestWorld("Patch", 1, 1);
    const updated = createTile(world, { x: 1, y: 0 }, "empty");

    expect(world.tiles["1,0"]).toBeUndefined();
    expect(updated.tiles["1,0"]).toBeDefined();
  });
});

describe("tile presence", () => {
  it("distinguishes blank tiles from missing coordinates", () => {
    const world = createTestWorld("Patch", 1, 1);

    expect(tileExists(world, 0, 0)).toBe(true);
    expect(getTileAt(world, 0, 0)?.terrain).toBe("empty");
    expect(tileExists(world, 1, 0)).toBe(false);
    expect(getTileAt(world, 1, 0)).toBeUndefined();
  });

  it("distinguishes chasm tiles from missing coordinates", () => {
    const world = createSparseWorld([{ x: 0, y: 0, terrain: "chasm" }]);

    expect(tileExists(world, 0, 0)).toBe(true);
    expect(getTileAt(world, 0, 0)?.terrain).toBe("chasm");
    expect(tileExists(world, 0, 1)).toBe(false);
  });
});

describe("boundary helpers", () => {
  it("detects boundary tiles with missing cardinal neighbours", () => {
    const world = createSparseWorld([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);

    expect(isBoundaryTile(world, "0,0")).toBe(true);
    expect(isBoundaryTile(world, "1,0")).toBe(true);
  });

  it("does not treat surrounded tiles as boundary tiles", () => {
    const world = createTestWorld("Block", 3, 3);

    expect(isBoundaryTile(world, "1,1")).toBe(false);
  });

  it("returns missing cardinal neighbours", () => {
    const world = createSparseWorld([{ x: 0, y: 0 }]);

    expect(getMissingCardinalNeighbours(world, "0,0")).toEqual([
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ]);
  });

  it("does not treat blank or chasm neighbours as missing space", () => {
    const world = createSparseWorld([
      { x: 0, y: 0, terrain: "empty" },
      { x: 1, y: 0, terrain: "chasm" },
      { x: 0, y: 1, terrain: "water" },
    ]);

    expect(getMissingCardinalNeighbours(world, "0,0")).toEqual([
      { x: 0, y: -1 },
      { x: -1, y: 0 },
    ]);
  });
});

describe("world migration", () => {
  it("migrates version 1 rectangular saves to version 3", () => {
    const legacy: LegacyWorldStateV1 = {
      version: 1,
      id: "legacy-id",
      name: "Legacy",
      width: 2,
      height: 2,
      tiles: {
        "0,0": normalizeMapTile({
          id: "0,0",
          x: 0,
          y: 0,
          terrain: "grassland",
        }),
        "1,1": normalizeMapTile({
          id: "1,1",
          x: 1,
          y: 1,
          terrain: "forest",
        }),
      },
      history: [
        {
          id: "action-1",
          sequence: 1,
          cardId: "wild-growth",
          cardName: "Wild Returns",
          targetIds: ["0,0"],
          appliedAt: "2026-01-01T00:00:00.000Z",
          changes: [
            {
              tileId: "0,0",
              before: normalizeMapTile({
                id: "0,0",
                x: 0,
                y: 0,
                terrain: "empty",
              }),
              after: normalizeMapTile({
                id: "0,0",
                x: 0,
                y: 0,
                terrain: "grassland",
              }),
            },
          ],
          randomSeed: "",
          resolvedValues: {},
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const migrated = parseWorld(JSON.stringify(legacy));

    expect(migrated.version).toBe(4);
    expect(migrated.turn).toBe(1);
    expect(migrated.settlementRegions).toBeDefined();
    expect(migrated.travelRoutes).toEqual({});
    expect(migrated.tiles["0,0"]?.terrain).toBe("grassland");
    expect(migrated.tiles["1,1"]?.terrain).toBe("forest");
    expect(migrated.tiles["0,0"]?.tags).toEqual([]);
    expect(migrated.tiles["0,0"]?.properties).toEqual({});
    expect(migrated.history).toHaveLength(1);
    expect(migrated.createdAt).toBe(legacy.createdAt);
    expect(migrated.updatedAt).toBe(legacy.updatedAt);
    expect("width" in migrated).toBe(false);
    expect("height" in migrated).toBe(false);
  });

  it("rejects unsupported future versions", () => {
    const payload = {
      version: 99,
      id: "future",
      name: "Future",
      tiles: {},
      history: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    expect(() => parseWorld(JSON.stringify(payload))).toThrow(
      /unsupported world version/i,
    );
  });
});

describe("export and import", () => {
  it("preserves negative coordinates in version 2 worlds", () => {
    const world = createSparseWorld([
      { x: -2, y: -1 },
      { x: 0, y: 0 },
    ]);
    const roundTrip = parseWorld(serializeWorld(world));

    expect(roundTrip.tiles["-2,-1"]).toBeDefined();
    expect(roundTrip.tiles["0,0"]).toBeDefined();
    expect(getWorldBounds(roundTrip)).toEqual({
      minX: -2,
      maxX: 0,
      minY: -1,
      maxY: 0,
    });
  });
});

describe("rendering data", () => {
  it("includes only existing tiles", () => {
    const world = createSparseWorld([
      { x: 0, y: 0 },
      { x: 2, y: 1 },
    ]);

    expect(getRenderableTileIds(world).sort()).toEqual(["0,0", "2,1"]);
  });
});
