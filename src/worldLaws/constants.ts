export const SETTLEMENT_THRESHOLDS = {
  town: 3,
  expanse: 5,
  urbanRegion: 7,
  quadrant: 10,
  sunder: 12,
} as const;

export const VILLAGE_RUIN_THRESHOLD = 3;

export const SETTLEMENT_TIER_DISPLAY_NAMES: Record<
  import("../world/worldTypes").SettlementTier,
  string
> = {
  town: "Town",
  expanse: "Expanse",
  "urban-region": "Urban",
  quadrant: "Quadrant",
  sunder: "Sunder",
};

export const INHOSPITABLE_TERRAINS = new Set(["empty", "desert"]);
