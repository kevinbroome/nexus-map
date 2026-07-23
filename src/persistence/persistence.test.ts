import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cards } from "../cards/cardDefinitions";
import { proposeAction } from "../rules/engine";
import { createTestWorld } from "../world/worldState";
import { commitWorldAction } from "../world/commitWorldAction";
import { LocalWorldRepository } from "./localWorldRepository";
import { InMemoryWorldRepository } from "./inMemoryWorldRepository";
import {
  PersistenceUnavailableError,
  RevisionConflictError,
  WorldNotFoundError,
} from "./repositoryErrors";
import { createWorldRepositoryForMode } from "./repositoryFactory";
import { setWorldRepository } from "./repositoryContext";
import { persistCommittedWorld } from "./persistCommittedWorld";
import { parseWorld, serializeWorld } from "./worldExport";
import { clearSavedWorld } from "./worldStorage";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("LocalWorldRepository", () => {
  let repository: LocalWorldRepository;

  beforeEach(() => {
    repository = new LocalWorldRepository();
    clearSavedWorld();
  });

  it("returns async results for all methods", async () => {
    const world = createTestWorld("Async", 2, 2);
    const created = await repository.createWorld(world);
    expect(created.revision).toBe(1);

    const listed = await repository.listWorlds();
    expect(listed).toHaveLength(1);

    const loaded = await repository.loadWorld(world.id);
    expect(loaded?.world.name).toBe("Async");

    const saved = await repository.saveWorld(world.id, {
      ...world,
      name: "Updated",
    });
    expect(saved.revision).toBe(2);

    await repository.deleteWorld(world.id);
    expect(await repository.listWorlds()).toHaveLength(0);
  });

  it("preserves complete WorldState on save and load", async () => {
    const world = createTestWorld("Complete", 3, 3);
    world.tiles["1,1"] = {
      ...world.tiles["1,1"]!,
      terrain: "forest",
    };

    await repository.createWorld(world);
    const loaded = await repository.loadWorld(world.id);

    expect(loaded?.world).toEqual(world);
  });

  it("runs migrations when loading legacy serialized worlds", async () => {
    const legacyWorld = createTestWorld("Legacy", 2, 2);
    localStorage.setItem("nexus-map-world", serializeWorld(legacyWorld));

    const loaded = await repository.loadWorld(legacyWorld.id);
    expect(loaded?.world.version).toBe(legacyWorld.version);
    expect(loaded?.revision).toBe(1);
  });

  it("round-trips through export/import serialization", async () => {
    const world = createTestWorld("Round trip", 4, 4);
    await repository.createWorld(world);

    const loaded = await repository.loadWorld(world.id);
    const exported = serializeWorld(loaded!.world);
    const imported = parseWorld(exported);

    expect(imported).toEqual(loaded!.world);
  });

  it("increments revision on each save", async () => {
    const world = createTestWorld("Revision", 2, 2);
    await repository.createWorld(world);

    const firstSave = await repository.saveWorld(world.id, world);
    const secondSave = await repository.saveWorld(world.id, world);

    expect(firstSave.revision).toBe(2);
    expect(secondSave.revision).toBe(3);
  });
});

describe("InMemoryWorldRepository", () => {
  let repository: InMemoryWorldRepository;

  beforeEach(() => {
    repository = new InMemoryWorldRepository();
  });

  it("increments revision after save", async () => {
    const world = createTestWorld("Memory", 2, 2);
    await repository.createWorld(world);

    const saved = await repository.saveWorld(world.id, world);
    expect(saved.revision).toBe(2);
  });

  it("throws RevisionConflictError for stale expected revision", async () => {
    const world = createTestWorld("Conflict", 2, 2);
    await repository.createWorld(world);

    await expect(
      repository.saveWorld(world.id, world, { expectedRevision: 99 }),
    ).rejects.toBeInstanceOf(RevisionConflictError);
  });

  it("simulates persistence failure", async () => {
    const world = createTestWorld("Fail", 2, 2);
    await repository.createWorld(world);
    repository.simulatePersistenceFailure(true);

    await expect(repository.saveWorld(world.id, world)).rejects.toBeInstanceOf(
      PersistenceUnavailableError,
    );
  });

  it("removes a world on delete", async () => {
    const world = createTestWorld("Delete", 2, 2);
    await repository.createWorld(world);
    await repository.deleteWorld(world.id);

    expect(await repository.loadWorld(world.id)).toBeNull();
  });
});

describe("persistCommittedWorld atomicity", () => {
  beforeEach(() => {
    setWorldRepository(new InMemoryWorldRepository());
  });

  it("leaves committed in-memory truth unchanged when save fails", async () => {
    const repository = new InMemoryWorldRepository();
    setWorldRepository(repository);

    const world = createTestWorld("Atomic", 3, 3);
    await repository.createWorld(world);
    repository.simulatePersistenceFailure(true);

    const card = cards.find((entry) => entry.id === "wild-growth")!;
    const proposal = proposeAction(world, card, ["1,1"], "atomic-seed");

    await expect(
      commitWorldAction(world, card, ["1,1"], proposal.randomSeed, proposal),
    ).rejects.toThrow();

    expect(world.turn).toBe(0);
    expect(world.history).toHaveLength(0);
  });
});

describe("repository factory", () => {
  it("defaults to local repository", () => {
    const repository = createWorldRepositoryForMode("local", {
      repositoryMode: "local",
    });

    expect(repository).toBeInstanceOf(LocalWorldRepository);
  });

  it("falls back to local repository in development when supabase config is missing", () => {
    const repository = createWorldRepositoryForMode("supabase", {
      repositoryMode: "supabase",
    });

    expect(repository).toBeInstanceOf(LocalWorldRepository);
  });
});

describe("architecture boundaries", () => {
  it("keeps localStorage access inside the local persistence adapter", () => {
    const allowedOutsideAdapter = new Set([
      join(projectRoot, "src/test-setup.ts"),
      join(projectRoot, "src/persistence/persistence.test.ts"),
      join(projectRoot, "src/visuals/themeManager.ts"),
    ]);

    const sourceFiles = collectSourceFiles(join(projectRoot, "src"));

    for (const filePath of sourceFiles) {
      const normalizedPath = filePath.replace(/\\/g, "/");

      if (normalizedPath.includes("/persistence/")) {
        continue;
      }

      if (allowedOutsideAdapter.has(filePath)) {
        continue;
      }

      const contents = readFileSync(filePath, "utf8");
      expect(contents.includes("localStorage"), normalizedPath).toBe(false);
    }
  });

  it("keeps rule engine modules free of repository imports", () => {
    const ruleFiles = collectSourceFiles(join(projectRoot, "src/rules"));

    for (const filePath of ruleFiles) {
      const contents = readFileSync(filePath, "utf8");
      expect(contents.includes("persistence/"), filePath).toBe(false);
      expect(contents.includes("@supabase/supabase-js"), filePath).toBe(false);
    }
  });

  it("keeps map rendering modules free of Supabase imports", () => {
    const mapFiles = collectSourceFiles(join(projectRoot, "src/map"));

    for (const filePath of mapFiles) {
      const contents = readFileSync(filePath, "utf8");
      expect(contents.includes("@supabase/supabase-js"), filePath).toBe(false);
    }
  });

  it("routes card commits through persistCommittedWorld", () => {
    const commitContents = readFileSync(
      join(projectRoot, "src/world/commitWorldAction.ts"),
      "utf8",
    );

    expect(commitContents.includes("persistCommittedWorld")).toBe(true);
    expect(commitContents.includes("saveWorld(")).toBe(false);
    expect(commitContents.includes("localStorage")).toBe(false);
  });
});

function collectSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }

  return files;
}
