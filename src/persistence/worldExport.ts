import type { WorldState } from "../world/worldTypes";
import { parseWorld, serializeWorld } from "./worldMigration";

export function exportWorldToFile(world: WorldState): void {
  const blob = new Blob([serializeWorld(world)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${world.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "world"}-v${world.version}.json`;
  link.click();

  URL.revokeObjectURL(url);
}

export async function importWorldFromFile(file: File): Promise<WorldState> {
  return parseWorld(await file.text());
}

export { parseWorld, serializeWorld };
