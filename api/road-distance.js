const KAKAO_DIRECTIONS_URL =
  "https://apis-navi.kakaomobility.com/v1/directions";
export const REQUEST_TIMEOUT_MS = 5000;

export const ROAD_JOURNEY_ORIGIN = Object.freeze({
  id: "gongju-city-hall",
  label: "공주시청",
  latitude: 36.446542105093314,
  longitude: 127.11922678155355,
});

export const ROAD_JOURNEY_DESTINATIONS = Object.freeze({
  "seoul-city-hall": Object.freeze({
    id: "seoul-city-hall",
    label: "서울시청",
    latitude: 37.5663,
    longitude: 126.9779,
  }),
  gwanghwamun: Object.freeze({
    id: "gwanghwamun",
    label: "광화문",
    latitude: 37.5759,
    longitude: 126.9768,
  }),
  gyeongbokgung: Object.freeze({
    id: "gyeongbokgung",
    label: "경복궁",
    latitude: 37.5796,
    longitude: 126.977,
  }),
});

function sendJson(response, statusCode, payload, cacheControl = "no-store") {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", cacheControl);
  response.end(JSON.stringify(payload));
}

function readRequestHeader(request, name) {
  const headers = request.headers;
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) ?? "";

  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value.join(",") : String(value ?? "");
}

export function buildKakaoDirectionsUrl(destination) {
  const url = new URL(KAKAO_DIRECTIONS_URL);
  url.searchParams.set(
    "origin",
    `${ROAD_JOURNEY_ORIGIN.longitude},${ROAD_JOURNEY_ORIGIN.latitude}`,
  );
  url.searchParams.set(
    "destination",
    `${destination.longitude},${destination.latitude}`,
  );
  url.searchParams.set("priority", "RECOMMEND");
  url.searchParams.set("summary", "true");
  return url;
}

export function parseKakaoDirections(payload) {
  const route = payload?.routes?.[0];
  const distanceMeters = route?.summary?.distance;
  const durationSeconds = route?.summary?.duration;

  if (
    route?.result_code !== 0 ||
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
    distanceMeters: Math.round(distanceMeters),
    durationSeconds: Math.round(durationSeconds),
  };
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { status: "unavailable", code: "method-not-allowed" });
    return;
  }

  const requestUrl = new URL(request.url ?? "/api/road-distance", "https://gyeol.local");
  const queryKeys = [...requestUrl.searchParams.keys()];
  if (
    queryKeys.length !== 1 ||
    queryKeys[0] !== "destinationId" ||
    requestUrl.searchParams.getAll("destinationId").length !== 1
  ) {
    sendJson(response, 400, { status: "unavailable", code: "invalid-query" });
    return;
  }
  const destinationId = requestUrl.searchParams.get("destinationId") ?? "";
  const canonicalSearch = `?destinationId=${encodeURIComponent(destinationId)}`;
  if (requestUrl.search !== canonicalSearch) {
    sendJson(response, 400, { status: "unavailable", code: "non-canonical-query" });
    return;
  }

  const cacheBypassDirectives = `${readRequestHeader(request, "cache-control")},${readRequestHeader(request, "pragma")}`.toLowerCase();
  if (/\b(?:no-cache|no-store|max-age\s*=\s*0)\b/.test(cacheBypassDirectives)) {
    sendJson(response, 400, { status: "unavailable", code: "cache-bypass-rejected" });
    return;
  }
  const destination = ROAD_JOURNEY_DESTINATIONS[destinationId];

  if (!destination) {
    sendJson(response, 400, { status: "unavailable", code: "unsupported-destination" });
    return;
  }

  const apiKey = process.env.KAKAO_MOBILITY_REST_API_KEY?.trim();
  if (!apiKey) {
    sendJson(response, 503, { status: "unavailable", code: "provider-not-configured" });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const providerResponse = await fetch(buildKakaoDirectionsUrl(destination), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `KakaoAK ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    if (!providerResponse.ok) {
      sendJson(response, 502, { status: "unavailable", code: "provider-error" });
      return;
    }

    const route = parseKakaoDirections(await providerResponse.json());
    if (!route) {
      sendJson(response, 502, { status: "unavailable", code: "route-not-found" });
      return;
    }

    sendJson(
      response,
      200,
      {
        status: "success",
        destinationId: destination.id,
        method: "driving-route",
        provider: "kakao-mobility",
        priority: "RECOMMEND",
        ...route,
      },
      "public, s-maxage=120, stale-while-revalidate=180",
    );
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    sendJson(response, timedOut ? 504 : 502, {
      status: "unavailable",
      code: timedOut ? "provider-timeout" : "provider-error",
    });
  } finally {
    clearTimeout(timeout);
  }
}
