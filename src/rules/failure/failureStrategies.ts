export type ValidTargetCreationDefinition = {
  terrain?: import("../../world/worldTypes").TerrainType;
};

export function isUnsupportedFailureBehaviour(
  behaviour: import("./failureTypes").FailureBehaviourDefinition,
): string | null {
  if (behaviour.type === "draw-another") {
    return "Draw-another failure behaviour is not supported yet.";
  }

  if (behaviour.type === "create-valid-target") {
    return "Create-valid-target failure behaviour is not supported yet.";
  }

  return null;
}
