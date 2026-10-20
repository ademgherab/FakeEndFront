export type SaveOperation = "none" | "schema" | "settings" | "full";

export interface DirtyState {
  /** Method or path changed. */
  metaDirty: boolean;
  schemaDirty: boolean;
  settingsDirty: boolean;
}

/**
 * PRJ-07 rule: use the narrowest write path. Method/path changes require a full
 * replace; changing both schema and settings in one save also uses the full
 * endpoint so the two halves cannot be applied out of order.
 */
export function chooseSaveOperation({
  metaDirty,
  schemaDirty,
  settingsDirty,
}: DirtyState): SaveOperation {
  if (metaDirty) return "full";
  if (schemaDirty && settingsDirty) return "full";
  if (schemaDirty) return "schema";
  if (settingsDirty) return "settings";
  return "none";
}

export function isDirty(state: DirtyState): boolean {
  return state.metaDirty || state.schemaDirty || state.settingsDirty;
}

/** Deterministic stringify for object comparisons independent of key order. */
export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

export function valuesEqual(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}
