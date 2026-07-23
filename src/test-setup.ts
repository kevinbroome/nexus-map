import { randomUUID } from "node:crypto";
import { beforeEach, vi } from "vitest";
import { LocalWorldRepository } from "./persistence/localWorldRepository";
import { setActiveStoredRevision, setWorldRepository } from "./persistence/repositoryContext";
import { clearSavedWorld } from "./persistence/worldStorage";
import { resetSupabaseClientForTests } from "./supabase/client";

function installLocalStoragePolyfill(): void {
  if (typeof globalThis.localStorage !== "undefined") {
    return;
  }

  const store = new Map<string, string>();

  vi.stubGlobal("localStorage", {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  });
}

installLocalStoragePolyfill();

if (typeof globalThis.crypto === "undefined") {
  vi.stubGlobal("crypto", { randomUUID });
}

if (typeof globalThis.WebSocket === "undefined") {
  vi.stubGlobal("WebSocket", class WebSocket {});
}

beforeEach(() => {
  localStorage.clear();
  clearSavedWorld();
  resetSupabaseClientForTests();
  setWorldRepository(new LocalWorldRepository());
  setActiveStoredRevision(null);
});
