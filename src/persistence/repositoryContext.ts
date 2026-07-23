import type { WorldRepository } from "./worldRepository";
import { LocalWorldRepository } from "./localWorldRepository";

let activeRepository: WorldRepository = new LocalWorldRepository();
let activeRevision: number | null = null;

export function setWorldRepository(repository: WorldRepository): void {
  activeRepository = repository;
}

export function getWorldRepository(): WorldRepository {
  return activeRepository;
}

export function setActiveStoredRevision(revision: number | null): void {
  activeRevision = revision;
}

export function getActiveStoredRevision(): number | null {
  return activeRevision;
}

export function resetWorldRepositoryForTests(): void {
  activeRepository = new LocalWorldRepository();
  activeRevision = null;
}
