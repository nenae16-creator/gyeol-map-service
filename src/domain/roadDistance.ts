import { formatApproxDistance } from "./geoDistance";

export type RoadDistanceSuccess = {
  status: "success";
  destinationId: string;
  method: "driving-route";
  provider: "kakao-mobility";
  priority: "RECOMMEND";
  distanceMeters: number;
  durationSeconds: number;
};

export type RoadDistanceState =
  | { status: "loading"; destinationId: string }
  | RoadDistanceSuccess
  | { status: "unavailable"; destinationId: string };

export function parseRoadDistancePayload(
  payload: unknown,
  expectedDestinationId: string,
): RoadDistanceSuccess | null {
  if (!payload || typeof payload !== "object") return null;

  const value = payload as Record<string, unknown>;
  const distanceMeters = value.distanceMeters;
  const durationSeconds = value.durationSeconds;

  if (
    value.status !== "success" ||
    value.destinationId !== expectedDestinationId ||
    value.method !== "driving-route" ||
    value.provider !== "kakao-mobility" ||
    value.priority !== "RECOMMEND" ||
    typeof distanceMeters !== "number" ||
    typeof durationSeconds !== "number" ||
    !Number.isFinite(distanceMeters) ||
    !Number.isFinite(durationSeconds) ||
    distanceMeters <= 0 ||
    durationSeconds <= 0 ||
    distanceMeters > 2_000_000 ||
    durationSeconds > 604_800
  ) {
    return null;
  }

  return {
    status: "success",
    destinationId: expectedDestinationId,
    method: "driving-route",
    provider: "kakao-mobility",
    priority: "RECOMMEND",
    distanceMeters: Math.round(distanceMeters),
    durationSeconds: Math.round(durationSeconds),
  };
}

export function formatRoadDuration(durationSeconds: number | null) {
  if (durationSeconds === null || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return "산출 전";
  }

  const roundedMinutes = Math.max(5, Math.round(durationSeconds / 300) * 5);
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  if (hours === 0) return `약 ${minutes}분`;
  if (minutes === 0) return `약 ${hours}시간`;
  return `약 ${hours}시간 ${minutes}분`;
}

export function formatRoadDistanceSummary(state: RoadDistanceState) {
  if (state.status === "loading") return "계산 중…";
  if (state.status === "unavailable") return "현재 확인할 수 없음";
  return `${formatApproxDistance(state.distanceMeters)} · ${formatRoadDuration(state.durationSeconds)}`;
}
