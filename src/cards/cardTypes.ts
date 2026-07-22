export type CardDefinition = {
  id: string;
  name: string;
  description: string;
  targetType: "tile";
  action: "set-terrain" | "add-settlement";
  value: string;
};
