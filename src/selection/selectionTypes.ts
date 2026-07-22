export type SelectionMode = "single" | "adjacent" | "rectangle";

export type SelectionState = {
  mode: SelectionMode;
  tileIds: string[];
  rectangleAnchorId: string | null;
};

export function createEmptySelection(mode: SelectionMode): SelectionState {
  return {
    mode,
    tileIds: [],
    rectangleAnchorId: null,
  };
}
