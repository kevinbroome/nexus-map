import type { TileState } from "./worldTypes";

export type WorldState = {
  tiles: Map<string, TileState>;
};

export function createEmptyWorldState(): WorldState {
  return { tiles: new Map() };
}
