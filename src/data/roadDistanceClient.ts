import {
  parseRoadDistancePayload,
  type RoadDistanceState,
} from "../domain/roadDistance";

export async function fetchRoadDistance(
  destinationId: string,
  signal: AbortSignal,
): Promise<RoadDistanceState> {
  try {
    const response = await fetch(
      `/api/road-distance?destinationId=${encodeURIComponent(destinationId)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        signal,
      },
    );

    if (!response.ok) return { status: "unavailable", destinationId };

    const parsed = parseRoadDistancePayload(await response.json(), destinationId);
    return parsed ?? { status: "unavailable", destinationId };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return { status: "unavailable", destinationId };
  }
}
