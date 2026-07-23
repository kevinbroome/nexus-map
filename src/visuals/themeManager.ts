import type { MapVisualTheme } from "./theme";
import { WORKING_ATLAS_THEME } from "./themes/workingAtlas";

const THEME_STORAGE_KEY = "nexus-map:visual-theme";

const THEMES: Record<string, MapVisualTheme> = {
  [WORKING_ATLAS_THEME.id]: WORKING_ATLAS_THEME,
};

let activeTheme: MapVisualTheme = WORKING_ATLAS_THEME;

function readStoredThemeId(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredThemeId(themeId: string): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch {
    // Ignore storage failures.
  }
}

export function getMapTheme(): MapVisualTheme {
  return activeTheme;
}

export function getAvailableThemeIds(): string[] {
  return Object.keys(THEMES).sort();
}

export function setMapTheme(themeId: string): MapVisualTheme {
  const theme = THEMES[themeId];

  if (!theme) {
    throw new Error(`Unknown map theme "${themeId}".`);
  }

  activeTheme = theme;
  writeStoredThemeId(themeId);
  return theme;
}

export function initializeMapTheme(): MapVisualTheme {
  const storedId = readStoredThemeId();

  if (storedId && THEMES[storedId]) {
    activeTheme = THEMES[storedId]!;
    return activeTheme;
  }

  activeTheme = WORKING_ATLAS_THEME;
  return activeTheme;
}

export function registerMapTheme(theme: MapVisualTheme): void {
  THEMES[theme.id] = theme;
}
