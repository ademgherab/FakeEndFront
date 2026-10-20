import type { MetaResponse, Schema } from "@/lib/api/generated/schema";
import { schemaLimitProblems } from "@/lib/schema/tree";
import { analyzeSample, validatePath } from "@/lib/wizard/validation";
import type { WizardStep } from "@/stores/wizard";

export interface WizardStepDefinition {
  id: WizardStep;
  label: string;
  shortLabel: string;
  description: string;
}

export const WIZARD_STEPS: WizardStepDefinition[] = [
  {
    id: 1,
    label: "Sample & endpoint",
    shortLabel: "Sample",
    description: "Paste JSON and choose the method and path.",
  },
  {
    id: 2,
    label: "Schema",
    shortLabel: "Schema",
    description: "Review types, generators and field structure.",
  },
  {
    id: 3,
    label: "Settings",
    shortLabel: "Settings",
    description: "Set status, delay, errors, list size and pagination.",
  },
  {
    id: 4,
    label: "Preview",
    shortLabel: "Preview",
    description: "Check the generated response, then create the project.",
  },
];

export interface StepGateInput {
  step: WizardStep;
  sampleText: string;
  path: string;
  method: string;
  schema: Schema | null;
  settings: unknown | null;
  meta: MetaResponse | null;
}

/**
 * A step can be left only when its own data is valid. Later steps never make a
 * partially edited earlier step disappear.
 */
export function stepProblem(input: StepGateInput): string | null {
  if (!input.meta) return "API configuration is still loading.";
  const meta = input.meta;

  if (input.step === 1) {
    if (!meta.methods.includes(input.method as MetaResponse["methods"][number])) {
      return "Choose a supported HTTP method.";
    }
    const path = validatePath(input.path);
    if (!path.valid) return path.errors[0] ?? "Fix the endpoint path.";

    if (input.schema) return null;
    if (!input.sampleText.trim()) return "Paste a JSON sample or choose a template.";
    const sample = analyzeSample(input.sampleText, meta.limits.maxSampleBytes);
    if (!sample.valid) {
      return (
        sample.jsonError?.message ??
        sample.rootError ??
        sample.sizeError ??
        "The sample is not valid."
      );
    }
    return null;
  }

  if (input.step === 2) {
    if (!input.schema) return "Infer a schema before continuing.";
    const limits = schemaLimitProblems(input.schema, meta.limits);
    if (limits[0]) return limits[0].message;
    return null;
  }

  if (input.step === 3) {
    if (!input.settings) return "Review the endpoint settings before previewing.";
    return null;
  }

  return null;
}

export interface StepState {
  step: WizardStep;
  sampleText: string;
  path: string;
  method: string;
  schema: Schema | null;
  settings: unknown | null;
  meta: MetaResponse | null;
}

export function stepIsComplete(state: StepState): boolean {
  return stepProblem(state) === null;
}

/** The furthest step that may be opened without skipping an invalid step. */
export function furthestAccessibleStep(state: StepState): WizardStep {
  let step: WizardStep = 1;
  for (const definition of WIZARD_STEPS.slice(0, -1)) {
    const complete = stepIsComplete({ ...state, step: definition.id });
    if (!complete) return step;
    const next = Math.min(4, definition.id + 1) as WizardStep;
    step = next;
  }
  return step;
}

export function clampRequestedStep(
  requested: number,
  state: StepState,
): WizardStep {
  if (!Number.isFinite(requested)) return 1;
  const normalized = Math.min(4, Math.max(1, Math.trunc(requested))) as WizardStep;
  return Math.min(normalized, furthestAccessibleStep(state)) as WizardStep;
}

export function hasUnsavedWizardWork(state: {
  step: WizardStep;
  sampleText: string;
  schema: Schema | null;
  projectName: string;
}): boolean {
  return (
    state.step > 1 ||
    state.sampleText.trim().length > 0 ||
    Boolean(state.schema) ||
    state.projectName.trim().length > 0
  );
}
