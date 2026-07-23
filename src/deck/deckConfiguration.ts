import {
  FIRST_ADVANCED_TEST_DECK_MANIFEST,
  type DeckManifestEntry,
} from "../cards/advancedDeck/advancedDeckManifest";

export type { DeckManifestEntry };

export interface DeckConfiguration {
  id: string;
  name: string;
  description: string;
  manifest: DeckManifestEntry[];
}

export const DEFAULT_DECK_CONFIGURATION_ID = "first-advanced-test-deck";

export const FIRST_ADVANCED_TEST_DECK: DeckConfiguration = {
  id: DEFAULT_DECK_CONFIGURATION_ID,
  name: "First Advanced Test Deck",
  description:
    "Forty-card advanced test deck with twenty-five unique definitions covering creation, growth, connection, transformation, destruction, recovery, expansion, and deck manipulation.",
  manifest: FIRST_ADVANCED_TEST_DECK_MANIFEST,
};

const DECK_CONFIGURATIONS: DeckConfiguration[] = [FIRST_ADVANCED_TEST_DECK];

const LEGACY_DECK_CONFIGURATION_IDS = new Set([
  "legacy-imported",
  "legacy-test-deck",
]);

/** Map removed or unknown deck configuration ids to the current default. */
export function normalizeDeckConfigurationId(
  id: string | undefined | null,
): string {
  if (!id || LEGACY_DECK_CONFIGURATION_IDS.has(id)) {
    return DEFAULT_DECK_CONFIGURATION_ID;
  }

  return getDeckConfiguration(id) ? id : DEFAULT_DECK_CONFIGURATION_ID;
}

export function getDeckConfiguration(id: string): DeckConfiguration | undefined {
  return DECK_CONFIGURATIONS.find((entry) => entry.id === id);
}

export function getAllDeckConfigurations(): DeckConfiguration[] {
  return [...DECK_CONFIGURATIONS];
}
