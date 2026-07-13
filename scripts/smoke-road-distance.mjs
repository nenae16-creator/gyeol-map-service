import assert from "node:assert/strict";

const urlArgument = process.argv
  .slice(2)
  .find((argument) => argument.startsWith("--url="));
if (!urlArgument) {
  throw new Error("--url=https://배포주소 형식으로 검사 대상을 지정해 주세요.");
}

const baseUrl = new URL(urlArgument.slice("--url=".length));
assert(/^https?:$/.test(baseUrl.protocol), "HTTP(S) 배포 주소만 검사할 수 있습니다.");
assert(!baseUrl.username && !baseUrl.password, "인증정보가 포함된 주소는 사용할 수 없습니다.");
const protectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();

async function request(destinationId) {
  const url = new URL("/api/road-distance", baseUrl);
  url.searchParams.set("destinationId", destinationId);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(protectionBypass
        ? { "x-vercel-protection-bypass": protectionBypass }
        : {}),
    },
    redirect: "error",
  });
  const contentType = response.headers.get("content-type") ?? "";
  assert(contentType.includes("application/json"), "도로거리 함수가 JSON을 반환하지 않았습니다.");
  const text = await response.text();
  assert(!/KakaoAK|KAKAO_MOBILITY_REST_API_KEY|authorization/i.test(text), "도로거리 응답에 인증 정보가 포함됐습니다.");
  return { response, payload: JSON.parse(text) };
}

const supported = await request("seoul-city-hall");
assert([200, 503].includes(supported.response.status), "지원 목적지 응답 상태가 계약과 다릅니다.");
if (supported.response.status === 200) {
  assert(
    supported.payload.status === "success" &&
      supported.payload.destinationId === "seoul-city-hall" &&
      supported.payload.method === "driving-route" &&
      Number.isFinite(supported.payload.distanceMeters) &&
      Number.isFinite(supported.payload.durationSeconds),
    "배포 도로거리 성공 응답이 계약과 다릅니다.",
  );
} else {
  assert(
    supported.payload.status === "unavailable" &&
      supported.payload.code === "provider-not-configured",
    "키 미설정 응답이 계약과 다릅니다.",
  );
}

const unsupported = await request("unknown");
assert(
  unsupported.response.status === 400 &&
    unsupported.payload.code === "unsupported-destination",
  "지원하지 않는 목적지 차단이 동작하지 않습니다.",
);

console.log(
  `도로거리 배포 함수 스모크 검사를 통과했습니다. (지원 목적지 HTTP ${supported.response.status})`,
);
