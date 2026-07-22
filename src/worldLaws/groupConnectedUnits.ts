/**
 * Deterministic greedy partitioning: sorts units, then repeatedly grows
 * connected groups via BFS until the threshold is reached. Only exact-threshold
 * groups are returned; incomplete groups are left unpromoted.
 */
export function groupConnectedUnits<T>(
  units: T[],
  threshold: number,
  getId: (unit: T) => string,
  areConnected: (first: T, second: T) => boolean,
  compareUnits?: (left: T, right: T) => number,
): T[][] {
  if (threshold <= 0 || units.length < threshold) {
    return [];
  }

  const sortedUnits = [...units].sort(
    compareUnits ?? ((left, right) => getId(left).localeCompare(getId(right))),
  );
  const assigned = new Set<string>();
  const groups: T[][] = [];

  for (const startUnit of sortedUnits) {
    const startId = getId(startUnit);

    if (assigned.has(startId)) {
      continue;
    }

    const group: T[] = [startUnit];
    const groupIds = new Set<string>([startId]);
    const queue = [startUnit];

    while (queue.length > 0 && group.length < threshold) {
      const current = queue.shift()!;

      for (const candidate of sortedUnits) {
        const candidateId = getId(candidate);

        if (assigned.has(candidateId) || groupIds.has(candidateId)) {
          continue;
        }

        if (!areConnected(current, candidate)) {
          continue;
        }

        group.push(candidate);
        groupIds.add(candidateId);
        queue.push(candidate);

        if (group.length >= threshold) {
          break;
        }
      }
    }

    if (group.length === threshold) {
      for (const unit of group) {
        assigned.add(getId(unit));
      }

      groups.push(group);
    }
  }

  groups.sort((left, right) =>
    (compareUnits ?? ((a, b) => getId(a).localeCompare(getId(b))))(
      left[0]!,
      right[0]!,
    ),
  );

  return groups;
}
