import type { SettlementTier } from "../world/worldTypes";

function hashString(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(36);
}

export function createRegionId(
  tier: SettlementTier,
  childIds: string[],
): string {
  const sortedChildren = [...childIds].sort();
  return `${tier}-${hashString(sortedChildren.join("|"))}`;
}
