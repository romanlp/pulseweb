const GOOGLE_HEALTH_STEPS_URL =
  "https://health.googleapis.com/v4/users/me/dataTypes/steps/dataPoints:reconcile";

type GoogleHealthStepsResponse = {
  dataPoints?: Array<{
    steps?: {
      count?: string;
      interval?: {
        startTime?: string;
        endTime?: string;
      };
    };
  }>;
  error?: {
    message?: string;
  };
};

export type StepSample = {
  count: number;
  startTime: string;
  endTime: string;
};

export async function fetchRecentSteps(accessToken: string) {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const filter = [
    `steps.interval.start_time >= "${start.toISOString()}"`,
    `steps.interval.start_time < "${end.toISOString()}"`,
  ].join(" AND ");
  const url = new URL(GOOGLE_HEALTH_STEPS_URL);

  url.searchParams.set("filter", filter);
  url.searchParams.set("pageSize", "10000");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as GoogleHealthStepsResponse;

  if (!response.ok) {
    throw new GoogleHealthError(
      body.error?.message ?? "Google Health request failed.",
      response.status,
    );
  }

  const samples: StepSample[] = (body.dataPoints ?? []).flatMap((point) => {
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

export class GoogleHealthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
