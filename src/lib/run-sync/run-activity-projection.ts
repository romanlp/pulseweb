import type { RunV1 } from "./run-v1";

export type RunActivityProjection = {
  sourceRunId: string;
  startedAtEpochMillis: number;
  endedAtEpochMillis: number;
  status: RunV1["session"]["status"];
  outcome: RunV1["session"]["outcome"];
  workoutLabel: string | null;
  locationCount: number;
  heartRateCount: number;
  cueCount: number;
  pauseCount: number;
  executionCount: number;
};

export function buildRunActivityProjection(
  run: RunV1,
): RunActivityProjection {
  return {
    sourceRunId: run.sourceRunId,
    startedAtEpochMillis: run.session.startedAtEpochMillis,
    endedAtEpochMillis: run.session.endedAtEpochMillis,
    status: run.session.status,
    outcome: run.session.outcome,
    workoutLabel: run.workout?.label ?? null,
    locationCount: run.locations.length,
    heartRateCount: run.heartRates.length,
    cueCount: run.cues.length,
    pauseCount: run.pauses.length,
    executionCount: run.executions.length,
  };
}
