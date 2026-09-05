import { z } from "zod";

import runSchemaText from "./run-v1.schema.json?raw";

interface Sequenced {
  sequence: number;
}

interface Location extends Sequenced {
  recordedAtEpochMillis: number;
}

interface HeartRate extends Sequenced {
  receivedAtEpochMillis: number;
}

interface Cue extends Sequenced {
  issuedAtEpochMillis: number;
}

interface Pause extends Sequenced {
  pausedAtEpochMillis: number;
}

interface Goal {
  kind: "duration" | "distance" | "heart_rate";
  lowerBpm?: number;
  upperBpm?: number;
}

interface WorkoutStep {
  stepId: string;
  goals: Goal[];
}

interface WorkoutBlock {
  blockId: string;
  kind: "single" | "repeat";
  repeatCount: number | null;
  steps: WorkoutStep[];
}

interface Workout {
  goals: Goal[];
  blocks: WorkoutBlock[];
}

interface Execution {
  executionId: string;
  executionIndex: number;
  logicalStepId: string | null;
  repetitionIndex: number | null;
  repetitionCount: number | null;
}

export interface RunV1 {
  schemaVersion: 1;
  sourceRunId: string;
  session: {
    status: "completed" | "failed";
    outcome: "completed_as_planned" | "ended_early" | "failed" | "unknown";
  };
  workout: Workout | null;
  locations: Location[];
  heartRates: HeartRate[];
  cues: Cue[];
  pauses: Pause[];
  executions: Execution[];
  availability: {
    workoutSnapshot: "present" | "unavailable";
    locations: "present" | "unavailable";
    heartRates: "present" | "unavailable";
  };
}

type JsonSchemaInput = Parameters<typeof z.fromJSONSchema>[0];

const runContractJsonSchema: JsonSchemaInput = JSON.parse(runSchemaText);
// SAFETY: The contract fixtures verify that successful parsing produces RunV1.
const importedRunContract = z.fromJSONSchema(
  runContractJsonSchema,
) as z.ZodType<RunV1>;

function hasContiguousOrderedSequence<T extends Sequenced>(
  items: T[],
  timestamp: (item: T) => number,
) {
  return items.every(
    (item, index) =>
      item.sequence === index &&
      (index === 0 || timestamp(item) >= timestamp(items[index - 1]!)),
  );
}

function hasValidGoals(goals: Goal[]) {
  return goals.every(
    (goal) =>
      goal.kind !== "heart_rate" ||
      (goal.lowerBpm !== undefined &&
        goal.upperBpm !== undefined &&
        goal.lowerBpm <= goal.upperBpm),
  );
}

export type RunV1Validation =
  | { ok: true; run: RunV1 }
  | { ok: false; code: "invalid_schema" | "unsupported_version" };

export type RunUploadCandidate =
  | null
  | boolean
  | number
  | string
  | RunUploadCandidate[]
  | { [key: string]: RunUploadCandidate };

export function validateRunV1(value: RunUploadCandidate): RunV1Validation {
  const contractResult = importedRunContract.safeParse(value);
  if (!contractResult.success) {
    const unsupportedVersion = contractResult.error.issues.some(
      (issue) => issue.path.length === 1 && issue.path[0] === "schemaVersion",
    );
    return {
      ok: false,
      code: unsupportedVersion ? "unsupported_version" : "invalid_schema",
    };
  }

  const run = contractResult.data;
  if (run.locations.length > 0 && run.availability.locations !== "present") {
    return { ok: false, code: "invalid_schema" };
  }
  if (run.heartRates.length > 0 && run.availability.heartRates !== "present") {
    return { ok: false, code: "invalid_schema" };
  }
  if (
    (run.workout !== null) !==
    (run.availability.workoutSnapshot === "present")
  ) {
    return { ok: false, code: "invalid_schema" };
  }
  if ((run.session.status === "failed") !== (run.session.outcome === "failed")) {
    return { ok: false, code: "invalid_schema" };
  }
  if (
    !hasContiguousOrderedSequence(
      run.locations,
      (item) => item.recordedAtEpochMillis,
    ) ||
    !hasContiguousOrderedSequence(
      run.heartRates,
      (item) => item.receivedAtEpochMillis,
    ) ||
    !hasContiguousOrderedSequence(run.cues, (item) => item.issuedAtEpochMillis) ||
    !hasContiguousOrderedSequence(run.pauses, (item) => item.pausedAtEpochMillis)
  ) {
    return { ok: false, code: "invalid_schema" };
  }

  const stepPlan: Array<{
    logicalStepId: string | null;
    repetitionIndex: number | null;
    repetitionCount: number | null;
  }> = [];

  if (run.workout) {
    if (!hasValidGoals(run.workout.goals)) {
      return { ok: false, code: "invalid_schema" };
    }

    const blockIds = new Set<string>();
    const stepIds = new Set<string>();
    for (const block of run.workout.blocks) {
      if (blockIds.has(block.blockId)) {
        return { ok: false, code: "invalid_schema" };
      }
      blockIds.add(block.blockId);

      if (
        (block.kind === "single" &&
          (block.repeatCount !== null || block.steps.length !== 1)) ||
        (block.kind === "repeat" && block.repeatCount === null)
      ) {
        return { ok: false, code: "invalid_schema" };
      }

      for (const step of block.steps) {
        if (stepIds.has(step.stepId) || !hasValidGoals(step.goals)) {
          return { ok: false, code: "invalid_schema" };
        }
        stepIds.add(step.stepId);
      }

      const repetitions = block.repeatCount ?? 1;
      if (stepPlan.length + repetitions * block.steps.length > 100_000) {
        return { ok: false, code: "invalid_schema" };
      }
      for (let repetition = 1; repetition <= repetitions; repetition += 1) {
        for (const step of block.steps) {
          stepPlan.push({
            logicalStepId: step.stepId,
            repetitionIndex: block.kind === "repeat" ? repetition : null,
            repetitionCount: block.repeatCount,
          });
        }
      }
    }

    if (run.workout.blocks.length === 0) {
      stepPlan.push({
        logicalStepId: null,
        repetitionIndex: null,
        repetitionCount: null,
      });
    }
  } else if (run.executions.length > 0) {
    return { ok: false, code: "invalid_schema" };
  }

  const executionIds = new Set<string>();
  const executionsAreValid = run.executions.every((execution, index) => {
    const planned = stepPlan[index];
    if (
      execution.executionIndex !== index ||
      executionIds.has(execution.executionId) ||
      !planned
    ) {
      return false;
    }
    executionIds.add(execution.executionId);
    return (
      execution.logicalStepId === planned.logicalStepId &&
      execution.repetitionIndex === planned.repetitionIndex &&
      execution.repetitionCount === planned.repetitionCount
    );
  });
  return executionsAreValid
    ? { ok: true, run }
    : { ok: false, code: "invalid_schema" };
}
