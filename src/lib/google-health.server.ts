const GOOGLE_HEALTH_DATA_TYPES_URL =
  "https://health.googleapis.com/v4/users/me/dataTypes";

type GoogleHealthErrorResponse = {
  error?: { message?: string };
};

type ObservationInterval = {
  startTime?: string;
  endTime?: string;
};

type GoogleHealthDataPoint = {
  steps?: {
    count?: string;
    interval?: ObservationInterval;
  };
  exercise?: {
    interval?: ObservationInterval;
    exerciseType?: string;
    displayName?: string;
    activeDuration?: string;
    metricsSummary?: {
      caloriesKcal?: number;
      distanceMillimeters?: number;
      steps?: string;
      averageHeartRateBeatsPerMinute?: string;
      activeZoneMinutes?: string;
      runVo2Max?: number;
    };
  };
  dailyVo2Max?: {
    date?: { year?: number; month?: number; day?: number };
    cardioFitnessLevel?: string;
    vo2Max?: number;
  };
};

type ReconciledResponse = GoogleHealthErrorResponse & {
  dataPoints?: GoogleHealthDataPoint[];
};

type RollupResponse = GoogleHealthErrorResponse & {
  rollupDataPoints?: Array<{
    distance?: { millimetersSum?: string };
    totalCalories?: { kcalSum?: number };
    activeZoneMinutes?: {
      sumInCardioHeartZone?: string;
      sumInPeakHeartZone?: string;
      sumInFatBurnHeartZone?: string;
    };
  }>;
};

export type StepSample = {
  count: number;
  startTime: string;
  endTime: string;
};

export type WorkoutSummary = {
  type: string;
  name: string;
  startTime: string;
  endTime: string;
  activeMinutes: number | null;
  distanceKm: number | null;
  caloriesKcal: number | null;
  averageHeartRate: number | null;
  activeZoneMinutes: number | null;
  runVo2Max: number | null;
};

async function googleHealthRequest<T extends GoogleHealthErrorResponse>(
  url: URL,
  accessToken: string,
  init?: RequestInit,
) {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(url, { ...init, headers });
  const body = (await response.json()) as T;

  if (!response.ok) {
    throw new GoogleHealthError(
      body.error?.message ?? "Google Health request failed.",
      response.status,
    );
  }

  return body;
}

async function fetchReconciledDataPoints(
  accessToken: string,
  dataType: string,
  filter: string,
  pageSize = 10_000,
) {
  const url = new URL(
    `${GOOGLE_HEALTH_DATA_TYPES_URL}/${dataType}/dataPoints:reconcile`,
  );
  url.searchParams.set("filter", filter);
  url.searchParams.set("pageSize", String(pageSize));

  const body = await googleHealthRequest<ReconciledResponse>(url, accessToken);
  return body.dataPoints ?? [];
}

async function fetchSevenDayRollup(
  accessToken: string,
  dataType: string,
  start: Date,
  end: Date,
) {
  const url = new URL(
    `${GOOGLE_HEALTH_DATA_TYPES_URL}/${dataType}/dataPoints:rollUp`,
  );
  const body = await googleHealthRequest<RollupResponse>(url, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      range: { startTime: start.toISOString(), endTime: end.toISOString() },
      windowSize: "604800s",
      pageSize: 1,
    }),
  });

  return body.rollupDataPoints ?? [];
}

function sevenDayRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}

function intervalFilter(dataType: string, start: Date, end: Date) {
  return [
    `${dataType}.interval.start_time >= "${start.toISOString()}"`,
    `${dataType}.interval.start_time < "${end.toISOString()}"`,
  ].join(" AND ");
}

function calendarDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDurationMinutes(duration?: string) {
  if (!duration) return null;
  const seconds = Number(duration.replace(/s$/, ""));
  return Number.isFinite(seconds) ? Math.round(seconds / 60) : null;
}

function optionalNumber(value: string | number | undefined) {
  if (value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function fetchRecentSteps(accessToken: string) {
  const { start, end } = sevenDayRange();
  const points = await fetchReconciledDataPoints(
    accessToken,
    "steps",
    intervalFilter("steps", start, end),
  );

  const samples: StepSample[] = points.flatMap((point) => {
    const count = Number(point.steps?.count ?? 0);
    const startTime = point.steps?.interval?.startTime;
    const endTime = point.steps?.interval?.endTime;

    if (!startTime || !endTime || !Number.isFinite(count)) return [];
    return [{ count, startTime, endTime }];
  });

  return {
    total: samples.reduce((sum, sample) => sum + sample.count, 0),
    sampleCount: samples.length,
    from: start.toISOString(),
    to: end.toISOString(),
    recent: samples.slice(0, 12),
  };
}

export async function fetchHealthSummary(accessToken: string) {
  const { start, end } = sevenDayRange();
  const tomorrow = new Date(end);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const [
    steps,
    distancePoints,
    zonePoints,
    caloriePoints,
    exercisePoints,
    vo2Points,
  ] = await Promise.all([
    fetchRecentSteps(accessToken),
    fetchSevenDayRollup(accessToken, "distance", start, end),
    fetchSevenDayRollup(accessToken, "active-zone-minutes", start, end),
    fetchSevenDayRollup(accessToken, "total-calories", start, end),
    fetchReconciledDataPoints(
      accessToken,
      "exercise",
      [
        `exercise.interval.civil_start_time >= "${calendarDate(start)}"`,
        `exercise.interval.civil_start_time < "${calendarDate(tomorrow)}"`,
      ].join(" AND "),
      25,
    ),
    fetchReconciledDataPoints(
      accessToken,
      "daily-vo2-max",
      [
        `daily_vo2_max.date >= "${calendarDate(start)}"`,
        `daily_vo2_max.date < "${calendarDate(tomorrow)}"`,
      ].join(" AND "),
    ),
  ]);

  const distanceMillimeters = distancePoints.reduce(
    (total, point) => total + Number(point.distance?.millimetersSum ?? 0),
    0,
  );
  const activeZoneMinutes = zonePoints.reduce(
    (total, point) =>
      total +
      Number(point.activeZoneMinutes?.sumInFatBurnHeartZone ?? 0) +
      Number(point.activeZoneMinutes?.sumInCardioHeartZone ?? 0) +
      Number(point.activeZoneMinutes?.sumInPeakHeartZone ?? 0),
    0,
  );
  const caloriesKcal = caloriePoints.reduce(
    (total, point) => total + Number(point.totalCalories?.kcalSum ?? 0),
    0,
  );

  const workouts: WorkoutSummary[] = exercisePoints
    .flatMap((point) => {
      const exercise = point.exercise;
      const startTime = exercise?.interval?.startTime;
      const endTime = exercise?.interval?.endTime;

      if (!exercise || !startTime || !endTime) return [];

      const metrics = exercise.metricsSummary;
      return [
        {
          type: exercise.exerciseType ?? "OTHER",
          name: exercise.displayName ?? "Workout",
          startTime,
          endTime,
          activeMinutes: parseDurationMinutes(exercise.activeDuration),
          distanceKm:
            metrics?.distanceMillimeters === undefined
              ? null
              : metrics.distanceMillimeters / 1_000_000,
          caloriesKcal: optionalNumber(metrics?.caloriesKcal),
          averageHeartRate: optionalNumber(
            metrics?.averageHeartRateBeatsPerMinute,
          ),
          activeZoneMinutes: optionalNumber(metrics?.activeZoneMinutes),
          runVo2Max: optionalNumber(metrics?.runVo2Max),
        },
      ];
    })
    .sort((a, b) => b.startTime.localeCompare(a.startTime))
    .slice(0, 5);

  const latestDailyVo2 = vo2Points
    .flatMap((point) => {
      const value = optionalNumber(point.dailyVo2Max?.vo2Max);
      const date = point.dailyVo2Max?.date;
      if (value === null || !date?.year || !date.month || !date.day) return [];

      return [
        {
          value,
          level: point.dailyVo2Max?.cardioFitnessLevel ?? null,
          date: `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`,
        },
      ];
    })
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const workoutVo2 = workouts.find((workout) => workout.runVo2Max !== null);

  return {
    from: start.toISOString(),
    to: end.toISOString(),
    steps,
    distanceKm:
      distancePoints.length > 0 ? distanceMillimeters / 1_000_000 : null,
    activeZoneMinutes: zonePoints.length > 0 ? activeZoneMinutes : null,
    caloriesKcal: caloriePoints.length > 0 ? caloriesKcal : null,
    vo2Max:
      latestDailyVo2 ??
      (workoutVo2
        ? {
            value: workoutVo2.runVo2Max,
            level: null,
            date: workoutVo2.startTime.slice(0, 10),
          }
        : null),
    workouts,
  };
}

export class GoogleHealthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
