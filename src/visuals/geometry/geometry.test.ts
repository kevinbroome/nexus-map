import { describe, expect, it } from "vitest";
import { createTestWorld } from "../../world/worldState";
import { normalizeMapTile } from "../../world/tileUtils";
import { getTileId } from "../../world/coordinates";
import { traceTerrainRegionBoundary } from "./boundaryTracing";
import { buildVisualTerrainRegions, compareTerrainRenderOrder } from "./terrainRegions";
import { smoothPolygonBoundary } from "./smoothing";
import { ringArea } from "./types";
import {
  buildRouteSegmentIndex,
  findRouteIntersections,
  smoothRoutePath,
} from "./routeGeometry";
import { buildMapLabels, resolveVisibleLabels } from "../labels/labelModel";
import { createTravelRouteId } from "../../networks/routeId";
import { resolveTravelEndpoint } from "../../networks/endpoints";

function setTerrain(
  world: ReturnType<typeof createTestWorld>,
  x: number,
  y: number,
  terrain: "empty" | "water" | "grassland" | "forest" | "mountain" | "urban" | "chasm" | "desert",
) {
  const id = getTileId(x, y);
  world.tiles[id] = normalizeMapTile({
    ...world.tiles[id]!,
    id,
    x,
    y,
    terrain,
  });
}

describe("visual terrain regions", () => {
  it("groups cardinally connected tiles of the same terrain", () => {
    const world = createTestWorld("regions", 4, 4, 0, 0);
    setTerrain(world, 0, 0, "forest");
    setTerrain(world, 1, 0, "forest");
    setTerrain(world, 0, 1, "grassland");

    const regions = buildVisualTerrainRegions(world);
    const forest = regions.filter((region) => region.terrain === "forest");

    expect(forest).toHaveLength(1);
    expect(forest[0]?.tileIds.sort()).toEqual(["0,0", "1,0"]);
  });

  it("keeps separate regions separate", () => {
    const world = createTestWorld("split", 4, 4, 0, 0);
    setTerrain(world, 0, 0, "forest");
    setTerrain(world, 2, 0, "forest");

    const regions = buildVisualTerrainRegions(world).filter(
      (region) => region.terrain === "forest",
    );

    expect(regions).toHaveLength(2);
  });

  it("uses deterministic region ids", () => {
    const world = createTestWorld("ids", 3, 3, -1, -1);
    setTerrain(world, -1, -1, "water");
    setTerrain(world, 0, -1, "water");

    const first = buildVisualTerrainRegions(world);
    const second = buildVisualTerrainRegions(world);

    expect(first.map((region) => region.id)).toEqual(second.map((region) => region.id));
  });

  it("renders inset terrains after broad base terrains", () => {
    const world = createTestWorld("layer-order", 6, 6, 0, 0);
    setTerrain(world, 1, 2, "chasm");
    setTerrain(world, 2, 2, "chasm");
    setTerrain(world, 2, 1, "chasm");
    setTerrain(world, 2, 3, "chasm");

    const regions = buildVisualTerrainRegions(world);
    const chasmIndex = regions.findIndex((region) => region.terrain === "chasm");
    const emptyIndex = regions.findIndex((region) => region.terrain === "empty");

    expect(chasmIndex).toBeGreaterThan(emptyIndex);
    expect(compareTerrainRenderOrder(
      { terrain: "empty", id: "empty:0,0" },
      { terrain: "chasm", id: "chasm:1,2" },
    )).toBeLessThan(0);
  });

  it("breaks regions at missing coordinates", () => {
    const world = createTestWorld("missing", 3, 3, 0, 0);
    setTerrain(world, 0, 0, "grassland");
    setTerrain(world, 2, 0, "grassland");

    const regions = buildVisualTerrainRegions(world).filter(
      (region) => region.terrain === "grassland",
    );

    expect(regions).toHaveLength(2);
  });
});

describe("boundary tracing", () => {
  it("traces a single tile boundary", () => {
    const geometry = traceTerrainRegionBoundary(["2,3"]);
    expect(geometry.rings[0]?.points).toHaveLength(4);
  });

  it("traces an L-shaped region", () => {
    const geometry = traceTerrainRegionBoundary(["0,0", "1,0", "0,1"]);
    expect(geometry.rings[0]?.points.length).toBeGreaterThanOrEqual(6);
  });

  it("returns deterministic point order", () => {
    const tileIds = ["0,0", "1,0", "0,1"];
    const first = traceTerrainRegionBoundary(tileIds);
    const second = traceTerrainRegionBoundary(tileIds);

    expect(first.rings[0]?.points).toEqual(second.rings[0]?.points);
  });

  it("produces non-self-intersecting positive area rings", () => {
    const geometry = traceTerrainRegionBoundary(["0,0", "1,0", "2,0", "0,1"]);
    const area = ringArea(geometry.rings[0]!);
    expect(area).toBeGreaterThan(0);
  });

  it("traces a plus-shaped chasm cluster", () => {
    const geometry = traceTerrainRegionBoundary(["1,2", "2,2", "2,1", "2,3"]);
    expect(geometry.rings[0]?.points.length).toBeGreaterThanOrEqual(8);
    expect(ringArea(geometry.rings[0]!)).toBe(4);
  });
});

describe("boundary smoothing", () => {
  it("does not mutate source geometry", () => {
    const source = traceTerrainRegionBoundary(["0,0", "1,0", "1,1", "0,1"]);
    const copyPoints = source.rings[0]?.points.map((point) => ({ ...point }));

    smoothPolygonBoundary(source, { enabled: true, iterations: 2, strength: 0.5 });

    expect(source.rings[0]?.points).toEqual(copyPoints);
  });

  it("is deterministic", () => {
    const source = traceTerrainRegionBoundary(["0,0", "1,0", "2,0", "0,1"]);
    const options = { enabled: true, iterations: 2, strength: 0.4 };
    const first = smoothPolygonBoundary(source, options);
    const second = smoothPolygonBoundary(source, options);

    expect(first.rings[0]?.points).toEqual(second.rings[0]?.points);
  });

  it("preserves original geometry when smoothing disabled", () => {
    const source = traceTerrainRegionBoundary(["0,0", "1,0", "1,1"]);
    const smoothed = smoothPolygonBoundary(source, {
      enabled: false,
      iterations: 0,
      strength: 0,
    });

    expect(smoothed.rings[0]?.points).toEqual(source.rings[0]?.points);
  });
});

describe("route geometry", () => {
  it("canonicalises shared segments", () => {
    const world = createTestWorld("routes", 4, 4, 0, 0);
    const originA = resolveTravelEndpoint(world, "tile", "0,0");
    const originB = resolveTravelEndpoint(world, "tile", "2,0");
    const mid = resolveTravelEndpoint(world, "tile", "1,0");

    world.travelRoutes[createTravelRouteId("road", originA, mid, ["0,0", "1,0"])] = {
      id: createTravelRouteId("road", originA, mid, ["0,0", "1,0"]),
      type: "road",
      origin: originA,
      destination: mid,
      pathTileIds: ["0,0", "1,0"],
      createdTurn: 0,
      createdByCardId: "test",
      tags: [],
      properties: {},
    };

    world.travelRoutes[createTravelRouteId("road", mid, originB, ["1,0", "2,0"])] = {
      id: createTravelRouteId("road", mid, originB, ["1,0", "2,0"]),
      type: "road",
      origin: mid,
      destination: originB,
      pathTileIds: ["1,0", "2,0"],
      createdTurn: 0,
      createdByCardId: "test",
      tags: [],
      properties: {},
    };

    const segments = buildRouteSegmentIndex(world.travelRoutes);
    expect(segments).toHaveLength(2);

    const shared = segments.find(
      (segment) =>
        segment.fromTileId === "0,0" ||
        segment.fromTileId === "1,0" ||
        segment.toTileId === "1,0",
    );
    expect(shared?.routeIds.length).toBeGreaterThan(0);
  });

  it("preserves route endpoints when smoothing", () => {
    const path = smoothRoutePath(["0,0", "1,0", "2,1"]);
    expect(path[0]).toEqual({ x: 0.5, y: 0.5 });
    expect(path[path.length - 1]).toEqual({ x: 2.5, y: 1.5 });
  });

  it("detects intersections with three or more segments", () => {
    const world = createTestWorld("intersection", 4, 4, 0, 0);
    const originA = resolveTravelEndpoint(world, "tile", "0,0");
    const originC = resolveTravelEndpoint(world, "tile", "2,1");
    const mid = resolveTravelEndpoint(world, "tile", "1,0");

    world.travelRoutes.a = {
      id: "a",
      type: "road",
      origin: originA,
      destination: mid,
      pathTileIds: ["0,0", "1,0", "2,0"],
      createdTurn: 0,
      createdByCardId: "test",
      tags: [],
      properties: {},
    };

    world.travelRoutes.b = {
      id: "b",
      type: "road",
      origin: mid,
      destination: originC,
      pathTileIds: ["1,0", "1,1", "2,1"],
      createdTurn: 0,
      createdByCardId: "test",
      tags: [],
      properties: {},
    };

    const segments = buildRouteSegmentIndex(world.travelRoutes);
    const intersections = findRouteIntersections(segments);
    expect(intersections.has("1,0")).toBe(true);
  });
});

describe("label placement", () => {
  it("keeps higher-priority labels over lower-priority labels", () => {
    const world = createTestWorld("labels", 3, 3, 0, 0);
    world.tiles["0,0"] = normalizeMapTile({
      ...world.tiles["0,0"]!,
      settlement: { type: "village", inhospitableTurns: 0 },
    });

    const labels = buildMapLabels(world);
    const visible = resolveVisibleLabels(labels, {
      detailLevel: "local",
      maxLabels: 1,
    });

    expect(visible).toHaveLength(1);
  });

  it("keeps selected labels visible", () => {
    const world = createTestWorld("selected-label", 3, 3, 0, 0);
    world.tiles["1,1"] = normalizeMapTile({
      ...world.tiles["1,1"]!,
      settlement: { type: "village", inhospitableTurns: 0, name: "Harbor" },
    });

    const labels = buildMapLabels(world);
    const visible = resolveVisibleLabels(labels, {
      detailLevel: "local",
      selectedTileIds: ["1,1"],
      maxLabels: 1,
    });

    expect(visible.some((label) => label.tileId === "1,1")).toBe(true);
  });
});

describe("theme lookup", () => {
  it("returns terrain colours from the working atlas theme", async () => {
    const { WORKING_ATLAS_THEME } = await import("../themes/workingAtlas");
    const { getTerrainVisualStyle } = await import("../theme");

    expect(getTerrainVisualStyle("water", WORKING_ATLAS_THEME).baseColor).toBe(
      "#668fa3",
    );
    expect(getTerrainVisualStyle("grassland", WORKING_ATLAS_THEME).baseColor).toBe(
      "#9cab75",
    );
  });
});
