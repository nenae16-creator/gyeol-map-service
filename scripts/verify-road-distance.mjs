import assert from "node:assert/strict";
import handler, {
  ROAD_JOURNEY_DESTINATIONS,
  ROAD_JOURNEY_ORIGIN,
  MEMORY_CACHE_TTL_MS,
  REQUEST_TIMEOUT_MS,
  buildKakaoDirectionsUrl,
  clearRoadDistanceMemoryCache,
  parseKakaoDirections,
} from "../api/road-distance.js";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const geoSource = await readFile(
  new URL("../src/domain/geoDistance.ts", import.meta.url),
  "utf8",
);
const geoCompiled = ts.transpileModule(geoSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const geoModuleUrl = `data:text/javascript;base64,${Buffer.from(geoCompiled).toString("base64")}`;
const source = await readFile(new URL("../src/domain/roadDistance.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText.replace('from "./geoDistance";', `from "${geoModuleUrl}";`);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
const { formatRoadDistanceSummary, formatRoadDuration, parseRoadDistancePayload } =
  await import(moduleUrl);

assert.equal(ROAD_JOURNEY_ORIGIN.latitude, 36.446542105093314);
assert.equal(ROAD_JOURNEY_ORIGIN.longitude, 127.11922678155355);
assert.equal(REQUEST_TIMEOUT_MS, 5000);
assert.equal(MEMORY_CACHE_TTL_MS, 120_000);
assert.deepEqual(Object.keys(ROAD_JOURNEY_DESTINATIONS).sort(), [
  "gwanghwamun",
  "gyeongbokgung",
  "seoul-city-hall",
]);

const requestUrl = buildKakaoDirectionsUrl(ROAD_JOURNEY_DESTINATIONS["seoul-city-hall"]);
assert.equal(requestUrl.origin, "https://apis-navi.kakaomobility.com");
assert.equal(requestUrl.pathname, "/v1/directions");
assert.equal(requestUrl.searchParams.get("origin"), "127.11922678155355,36.446542105093314");
assert.equal(requestUrl.searchParams.get("destination"), "126.9779,37.5663");
assert.equal(requestUrl.searchParams.get("priority"), "RECOMMEND");
assert.equal(requestUrl.searchParams.get("summary"), "true");

const providerPayload = {
  routes: [
    {
      result_code: 0,
      summary: { distance: 143_321.4, duration: 7_502.2 },
    },
  ],
};
assert.deepEqual(parseKakaoDirections(providerPayload), {
  distanceMeters: 143_321,
  durationSeconds: 7_502,
});
assert.equal(parseKakaoDirections({ routes: [{ result_code: 1 }] }), null);
assert.equal(parseKakaoDirections({ routes: [{ result_code: 0, summary: { distance: -1, duration: 1 } }] }), null);
assert.equal(parseKakaoDirections({ routes: [{ result_code: 0, summary: { distance: 2_000_001, duration: 1 } }] }), null);

const normalizedPayload = {
  status: "success",
  destinationId: "seoul-city-hall",
  method: "driving-route",
  provider: "kakao-mobility",
  priority: "RECOMMEND",
  distanceMeters: 143_321.4,
  durationSeconds: 7_502.2,
};
const parsed = parseRoadDistancePayload(normalizedPayload, "seoul-city-hall");
assert.equal(parsed?.distanceMeters, 143_321);
assert.equal(parsed?.durationSeconds, 7_502);
assert.equal(parseRoadDistancePayload(normalizedPayload, "gwanghwamun"), null);
assert.equal(parseRoadDistancePayload({ ...normalizedPayload, durationSeconds: Number.NaN }, "seoul-city-hall"), null);
assert.equal(formatRoadDuration(7_502), "약 2시간 5분");
assert.equal(formatRoadDuration(2_720), "약 45분");
assert.equal(formatRoadDuration(null), "산출 전");
assert.equal(formatRoadDistanceSummary({ status: "loading", destinationId: "seoul-city-hall" }), "계산 중…");
assert.equal(formatRoadDistanceSummary({ status: "unavailable", destinationId: "seoul-city-hall" }), "현재 확인할 수 없음");
assert.equal(formatRoadDistanceSummary(parsed), "약 143km · 약 2시간 5분");

function createResponse() {
  return {
    statusCode: 0,
    headers: new Map(),
    body: "",
    setHeader(name, value) {
      this.headers.set(name.toLowerCase(), String(value));
    },
    end(value) {
      this.body = String(value ?? "");
    },
  };
}

const originalApiKey = process.env.KAKAO_MOBILITY_REST_API_KEY;
const originalFetch = globalThis.fetch;
const originalSetTimeout = globalThis.setTimeout;
try {
  delete process.env.KAKAO_MOBILITY_REST_API_KEY;

  const methodResponse = createResponse();
  await handler(
    { method: "POST", url: "/api/road-distance?destinationId=seoul-city-hall" },
    methodResponse,
  );
  assert.equal(methodResponse.statusCode, 405);
  assert.equal(methodResponse.headers.get("allow"), "GET");

  const missingKeyResponse = createResponse();
  await handler(
    { method: "GET", url: "/api/road-distance?destinationId=seoul-city-hall" },
    missingKeyResponse,
  );
  assert.equal(missingKeyResponse.statusCode, 503);
  assert.equal(JSON.parse(missingKeyResponse.body).code, "provider-not-configured");

  const invalidDestinationResponse = createResponse();
  await handler(
    { method: "GET", url: "/api/road-distance?destinationId=unknown" },
    invalidDestinationResponse,
  );
  assert.equal(invalidDestinationResponse.statusCode, 400);

  const cacheBypassQueryResponse = createResponse();
  await handler(
    {
      method: "GET",
      url: "/api/road-distance?destinationId=seoul-city-hall&nonce=1",
    },
    cacheBypassQueryResponse,
  );
  assert.equal(cacheBypassQueryResponse.statusCode, 400);
  assert.equal(JSON.parse(cacheBypassQueryResponse.body).code, "invalid-query");

  for (const url of [
    "/api/road-distance?destinationId=seoul-city-hall&destinationId=seoul-city-hall",
    "/api/road-distance?destinationId=%73eoul-city-hall",
    "/api/road-distance?%64estinationId=seoul-city-hall",
  ]) {
    const nonCanonicalResponse = createResponse();
    await handler({ method: "GET", url }, nonCanonicalResponse);
    assert.equal(nonCanonicalResponse.statusCode, 400);
  }

  const cacheDirectiveResponse = createResponse();
  await handler(
    {
      method: "GET",
      url: "/api/road-distance?destinationId=seoul-city-hall",
      headers: { "cache-control": "no-cache" },
    },
    cacheDirectiveResponse,
  );
  assert.equal(cacheDirectiveResponse.statusCode, 400);
  assert.equal(JSON.parse(cacheDirectiveResponse.body).code, "cache-bypass-rejected");

  process.env.KAKAO_MOBILITY_REST_API_KEY = "unit-test-placeholder";
  clearRoadDistanceMemoryCache();
  let providerCallCount = 0;
  globalThis.fetch = async (_url, options) => {
    providerCallCount += 1;
    assert.equal(options?.headers?.Authorization, "KakaoAK unit-test-placeholder");
    assert.equal(options?.headers?.["Content-Type"], "application/json");
    return new Response(JSON.stringify(providerPayload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const successResponse = createResponse();
  await handler(
    { method: "GET", url: "/api/road-distance?destinationId=seoul-city-hall" },
    successResponse,
  );
  assert.equal(successResponse.statusCode, 200);
  assert.equal(JSON.parse(successResponse.body).distanceMeters, 143_321);
  assert.equal(
    successResponse.headers.get("cache-control"),
    "public, s-maxage=120, stale-while-revalidate=180",
  );
  assert(!successResponse.body.includes("unit-test-placeholder"));
  const memoryCacheResponse = createResponse();
  await handler(
    { method: "GET", url: "/api/road-distance?destinationId=seoul-city-hall" },
    memoryCacheResponse,
  );
  assert.equal(memoryCacheResponse.statusCode, 200);
  assert.equal(providerCallCount, 1);

  clearRoadDistanceMemoryCache();
  globalThis.fetch = async () => new Response("{}", { status: 502 });
  const providerErrorResponse = createResponse();
  await handler(
    { method: "GET", url: "/api/road-distance?destinationId=seoul-city-hall" },
    providerErrorResponse,
  );
  assert.equal(providerErrorResponse.statusCode, 502);
  assert.equal(JSON.parse(providerErrorResponse.body).code, "provider-error");

  clearRoadDistanceMemoryCache();
  globalThis.fetch = async () =>
    new Response("not-json", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  const malformedResponse = createResponse();
  await handler(
    { method: "GET", url: "/api/road-distance?destinationId=seoul-city-hall" },
    malformedResponse,
  );
  assert.equal(malformedResponse.statusCode, 502);

  clearRoadDistanceMemoryCache();
  globalThis.setTimeout = (callback, _delay, ...args) =>
    originalSetTimeout(callback, 0, ...args);
  globalThis.fetch = async (_url, options) =>
    new Promise((_resolve, reject) => {
      options?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    });
  const timeoutResponse = createResponse();
  await handler(
    { method: "GET", url: "/api/road-distance?destinationId=seoul-city-hall" },
    timeoutResponse,
  );
  assert.equal(timeoutResponse.statusCode, 504);
  assert.equal(JSON.parse(timeoutResponse.body).code, "provider-timeout");
} finally {
  if (originalApiKey === undefined) delete process.env.KAKAO_MOBILITY_REST_API_KEY;
  else process.env.KAKAO_MOBILITY_REST_API_KEY = originalApiKey;
  globalThis.fetch = originalFetch;
  globalThis.setTimeout = originalSetTimeout;
  clearRoadDistanceMemoryCache();
}

console.log("자동차 경로거리 요청·응답·표시 검사를 통과했습니다.");
