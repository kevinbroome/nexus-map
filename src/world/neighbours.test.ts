import { describe, expect, it } from "vitest";
import { resolveCardTargets } from "../rules/targets";
import { getPreviewTileIds, proposeAction } from "../rules/engine";
import { cards } from "../cards/cardDefinitions";
import { commitWorldAction } from "./commitWorldAction";
import { getTileId } from "./coordinates";
import {
  findSettlementClusters,
  getConnectedRegion,
  getConnectedSettlementCluster,
  getCoordinatesWithinDistance,
  getExistingNeighbours,
  getExistingTilesWithinDistance,
  getExistingTilesWithinGraphSteps,
  getMissingNeighbourCoordinates,
  getNeighbourCoordinates,
  hasSettlementType,
  isUrbanTile,
  matchesTerrain,
} from "./neighbours";
import { createTile } from "./tileCreation";
import { normalizeMapTile } from "./tileUtils";
import { createTestWorld } from "./worldState";
import type { WorldState } from "./worldTypes";
import * as worldStorage from "../persistence/worldStorage";
import { vi } from "vitest";

function createSparseWorld(
  tiles: Array<{
    x: number;
    y: number;
    terrain?: "empty" | "forest" | "water" | "chasm" | "urban";
    settlement?: "village" | "town" | "city";
  }>,
): WorldState {
  let world = createTestWorld("Sparse", 0, 0);

  for (const tile of tiles) {
    world = createTile(world, { x: tile.x, y: tile.y }, tile.terrain ?? "empty");

    if (tile.settlement) {
      const id = getTileId(tile.x, tile.y);
      world = {
        ...world,
        tiles: {
          ...world.tiles,
          [id]: normalizeMapTile({
            ...world.tiles[id]!,
            settlement: { type: tile.settlement },
          }),
        },
      };
    }
  }

  return world;
}

describe("getNeighbourCoordinates", () => {
  const origin = { x: 2, y: 3 };

  it("returns cardinal neighbours in north, east, south, west order", () => {
    expect(getNeighbourCoordinates(origin, "cardinal")).toEqual([
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 2, y: 4 },
      { x: 1, y: 3 },
    ]);
  });

  it("returns diagonal neighbours in a consistent order", () => {
    expect(getNeighbourCoordinates(origin, "diagonal")).toEqual([
      { x: 3, y: 2 },
      { x: 3, y: 4 },
      { x: 1, y: 4 },
      { x: 1, y: 2 },
    ]);
  });

  it("returns all eight surrounding neighbours", () => {
    expect(getNeighbourCoordinates(origin, "all")).toHaveLength(8);
    expect(getNeighbourCoordinates(origin, "all")).toEqual([
      ...getNeighbourCoordinates(origin, "cardinal"),
      ...getNeighbourCoordinates(origin, "diagonal"),
    ]);
  });
});

describe("existing neighbour queries", () => {
  it("excludes missing coordinates from existing-neighbour results", () => {
    const world = createSparseWorld([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);

    expect(getExistingNeighbours(world, "0,0", "cardinal")).toHaveLength(1);
    expect(getExistingNeighbours(world, "0,0", "cardinal")[0]?.id).toBe("1,0");
  });

  it("counts blank and chasm tiles as existing neighbours", () => {
    const world = createSparseWorld([
      { x: 0, y: 0, terrain: "empty" },
      { x: 1, y: 0, terrain: "chasm" },
      { x: 0, y: 1, terrain: "water" },
    ]);

    expect(getExistingNeighbours(world, "0,0", "cardinal")).toHaveLength(2);
    expect(
      getMissingNeighbourCoordinates(world, "0,0", "cardinal"),
    ).toEqual([
      { x: 0, y: -1 },
      { x: -1, y: 0 },
    ]);
  });

  it("throws for an invalid origin tile id", () => {
    const world = createTestWorld("Patch", 1, 1);

    expect(() => getExistingNeighbours(world, "9,9", "cardinal")).toThrow(
      /does not exist/i,
    );
  });
});

describe("distance queries", () => {
  const origin = { x: 0, y: 0 };

  it("returns Manhattan distance coordinates", () => {
    expect(getCoordinatesWithinDistance(origin, 1, { metric: "manhattan" })).toEqual([
      { x: 0, y: -1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ]);
  });

  it("returns Chebyshev distance coordinates including diagonals", () => {
    expect(getCoordinatesWithinDistance(origin, 1, { metric: "chebyshev" })).toEqual([
      { x: -1, y: -1 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: -1, y: 1 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
  });

  it("can include the origin coordinate", () => {
    expect(
      getCoordinatesWithinDistance(origin, 0, {
        metric: "manhattan",
        includeOrigin: true,
      }),
    ).toEqual([origin]);
  });

  it("rejects negative distances", () => {
    expect(() => getCoordinatesWithinDistance(origin, -1)).toThrow(
      /zero or greater/i,
    );
  });

  it("returns only existing tiles within distance", () => {
    const world = createSparseWorld([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);

    expect(
      getExistingTilesWithinDistance(world, "0,0", 1, { metric: "chebyshev" }),
    ).toHaveLength(1);
  });
});

describe("getConnectedRegion", () => {
  it("does not cross missing coordinates", () => {
    const world = createSparseWorld([
      { x: 0, y: 0, terrain: "forest" },
      { x: 2, y: 0, terrain: "forest" },
    ]);

    expect(
      getConnectedRegion(world, "0,0", matchesTerrain("forest"), "cardinal"),
    ).toHaveLength(1);
  });

  it("does not cross non-matching terrain", () => {
    const world = createSparseWorld([
      { x: 0, y: 0, terrain: "forest" },
      { x: 1, y: 0, terrain: "grassland" },
      { x: 2, y: 0, terrain: "forest" },
    ]);

    expect(
      getConnectedRegion(world, "0,0", matchesTerrain("forest"), "cardinal").map(
        (tile) => tile.id,
      ),
    ).toEqual(["0,0"]);
  });

  it("treats diagonal-only contact as disconnected in cardinal mode", () => {
    const world = createSparseWorld([
      { x: 0, y: 0, terrain: "forest" },
      { x: 1, y: 1, terrain: "forest" },
    ]);

    expect(
      getConnectedRegion(world, "0,0", matchesTerrain("forest"), "cardinal"),
    ).toHaveLength(1);
    expect(
      getConnectedRegion(world, "0,0", matchesTerrain("forest"), "all"),
    ).toHaveLength(2);
  });

  it("works on irregular maps with negative coordinates", () => {
    const world = createSparseWorld([
      { x: -1, y: 0, terrain: "forest" },
      { x: 0, y: 0, terrain: "forest" },
      { x: 0, y: -1, terrain: "grassland" },
      { x: -1, y: -1, terrain: "forest" },
    ]);

    expect(
      getConnectedRegion(world, "0,0", matchesTerrain("forest"), "cardinal").map(
        (tile) => tile.id,
      ),
    ).toEqual(["-1,-1", "-1,0", "0,0"]);
  });

  it("returns an empty array when the starting tile does not match", () => {
    const world = createSparseWorld([{ x: 0, y: 0, terrain: "grassland" }]);

    expect(
      getConnectedRegion(world, "0,0", matchesTerrain("forest"), "cardinal"),
    ).toEqual([]);
  });
});

describe("predicates", () => {
  it("identifies urban tiles by terrain or settlement", () => {
    expect(
      isUrbanTile(
        normalizeMapTile({ id: "0,0", x: 0, y: 0, terrain: "urban" }),
      ),
    ).toBe(true);
    expect(
      isUrbanTile(
        normalizeMapTile({
          id: "1,0",
          x: 1,
          y: 0,
          terrain: "grassland",
          settlement: { type: "village" },
        }),
      ),
    ).toBe(true);
    expect(
      isUrbanTile(
        normalizeMapTile({ id: "2,0", x: 2, y: 0, terrain: "grassland" }),
      ),
    ).toBe(false);
  });

  it("matches settlement types", () => {
    const tile = normalizeMapTile({
      id: "0,0",
      x: 0,
      y: 0,
      terrain: "grassland",
      settlement: { type: "village", inhospitableTurns: 0 },
    });

    expect(hasSettlementType("village")(tile)).toBe(true);
    expect(hasSettlementType("town")(tile)).toBe(false);
  });
});

describe("settlement clusters", () => {
  it("groups connected settlements and leaves isolated tiles as size-one clusters", () => {
    const world = createSparseWorld([
      { x: 0, y: 0, settlement: "village" },
      { x: 1, y: 0, settlement: "village" },
      { x: 3, y: 0, settlement: "town" },
    ]);

    const clusters = findSettlementClusters(world, "cardinal");

    expect(clusters).toHaveLength(2);
    expect(clusters[0]?.map((tile) => tile.id).sort()).toEqual(["0,0", "1,0"]);
    expect(clusters[1]?.map((tile) => tile.id)).toEqual(["3,0"]);
  });

  it("places every settlement tile in exactly one cluster", () => {
    const world = createSparseWorld([
      { x: 0, y: 0, settlement: "village" },
      { x: 1, y: 0, settlement: "village" },
      { x: 0, y: 2, settlement: "town" },
      { x: 1, y: 2, settlement: "city" },
    ]);

    const clusters = findSettlementClusters(world, "cardinal");
    const clusteredIds = clusters.flatMap((cluster) =>
      cluster.map((tile) => tile.id),
    );

    expect(new Set(clusteredIds).size).toBe(clusteredIds.length);
    expect(clusteredIds.sort()).toEqual(["0,0", "0,2", "1,0", "1,2"]);
  });

  it("returns a connected settlement cluster from a starting tile", () => {
    const world = createSparseWorld([
      { x: 0, y: 0, settlement: "village" },
      { x: 1, y: 0, settlement: "village" },
    ]);

    expect(
      getConnectedSettlementCluster(world, "0,0", "cardinal").map(
        (tile) => tile.id,
      ),
    ).toEqual(["0,0", "1,0"]);
  });
});

describe("adjacent card targeting compatibility", () => {
  it("keeps existing adjacent card behaviour unchanged", () => {
    const world = createTestWorld("Test", 4, 4);
    const graphTargets = getExistingTilesWithinGraphSteps(
      world,
      "0,0",
      1,
      "cardinal",
    ).map((tile) => tile.id);
    const cardTargets = resolveCardTargets(
      world,
      { type: "adjacent-tiles", radius: 1 },
      ["0,0"],
    );

    expect(cardTargets).toEqual({
      ok: true,
      targetIds: graphTargets,
    });
    expect(graphTargets.sort()).toEqual(["0,0", "0,1", "1,0"].sort());
    expect(graphTargets).not.toContain(getTileId(-1, 0));
  });
});

describe("connected-region card integration", () => {
  it("previews and commits the same connected region targets", () => {
    vi.spyOn(worldStorage, "saveWorld").mockImplementation(() => undefined);

    let world = createTestWorld("Test", 4, 4);

    for (const id of ["0,0", "1,0", "2,0", "1,1"]) {
      world = {
        ...world,
        tiles: {
          ...world.tiles,
          [id]: normalizeMapTile({
            ...world.tiles[id]!,
            terrain: "forest",
          }),
        },
      };
    }

    const card = cards.find((entry) => entry.id === "wild-consumes-itself")!;
    const preview = proposeAction(world, card, ["1,0"], "region-seed");
    const committed = commitWorldAction(
      world,
      card,
      ["1,0"],
      preview.randomSeed,
      preview,
    );

    expect(preview.valid).toBe(true);
    expect(preview.targetIds.sort()).toEqual(["0,0", "1,0", "1,1", "2,0"]);
    expect(getPreviewTileIds(preview).sort()).toEqual(preview.targetIds.sort());
    expect(
      committed.world.tiles["0,0"]?.tags.includes("ancient"),
    ).toBe(true);
    expect(
      committed.world.tiles["2,0"]?.tags.includes("ancient"),
    ).toBe(true);
    expect(committed.action.targetIds.sort()).toEqual(preview.targetIds.sort());
  });
});
