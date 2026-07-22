import { describe, expect, it } from "vitest";
import { createWorld } from "../world/worldState";
import {
  handleTileSelection,
  setSelectionMode,
} from "./selection";
import { createEmptySelection } from "./selectionTypes";

describe("selection", () => {
  const world = createWorld("Test", 4, 4);

  it("selects a single tile in single mode", () => {
    const selection = handleTileSelection(
      world,
      createEmptySelection("single"),
      "1,1",
    );

    expect(selection.tileIds).toEqual(["1,1"]);
  });

  it("adds adjacent tiles in adjacent mode", () => {
    let selection = handleTileSelection(
      world,
      createEmptySelection("adjacent"),
      "1,1",
    );
    selection = handleTileSelection(world, selection, "2,1");

    expect(selection.tileIds).toEqual(["1,1", "2,1"]);
  });

  it("replaces non-adjacent picks in adjacent mode", () => {
    let selection = handleTileSelection(
      world,
      createEmptySelection("adjacent"),
      "0,0",
    );
    selection = handleTileSelection(world, selection, "3,3");

    expect(selection.tileIds).toEqual(["3,3"]);
  });

  it("selects a rectangle from two corners", () => {
    let selection = handleTileSelection(
      world,
      createEmptySelection("rectangle"),
      "0,0",
    );
    selection = handleTileSelection(world, selection, "2,1");

    expect(selection.tileIds).toEqual([
      "0,0",
      "1,0",
      "2,0",
      "0,1",
      "1,1",
      "2,1",
    ]);
  });

  it("clears selection when changing mode", () => {
    const selection = setSelectionMode(
      {
        mode: "single",
        tileIds: ["1,1"],
        rectangleAnchorId: null,
      },
      "rectangle",
    );

    expect(selection.tileIds).toEqual([]);
    expect(selection.mode).toBe("rectangle");
  });
});
