export function createDeckInstanceId(params: {
  definitionId: string;
  createdTurn: number;
  createdByActionId?: string;
  copySequence?: number;
  initialIndex?: number;
}): string {
  const parts = [params.definitionId, `t${params.createdTurn}`];

  if (params.createdByActionId) {
    parts.push(`a${params.createdByActionId}`);
  }

  if (params.initialIndex !== undefined) {
    parts.push(`i${params.initialIndex}`);
  }

  if (params.copySequence !== undefined) {
    parts.push(`c${params.copySequence}`);
  }

  return parts.join(":");
}

export function validateUniqueInstanceIds(instances: { instanceId: string }[]): string[] {
  const seen = new Set<string>();
  const messages: string[] = [];

  for (const instance of instances) {
    if (seen.has(instance.instanceId)) {
      messages.push(`Duplicate deck instance ID "${instance.instanceId}".`);
    }

    seen.add(instance.instanceId);
  }

  return messages;
}
