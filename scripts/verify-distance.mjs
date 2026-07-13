import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const distanceModulePath = fileURLToPath(
  new URL("../src/domain/geoDistance.ts", import.meta.url)
);
const distanceSource = await readFile(distanceModulePath, "utf8");
const transpiledDistanceModule = ts.transpileModule(distanceSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2020
  }
}).outputText;
const distanceModuleUrl = `data:text/javascript;base64,${Buffer.from(
  transpiledDistanceModule
).toString("base64")}`;
const { formatApproxDistance, greatCircleDistanceMeters } = await import(
  distanceModuleUrl
);

const originPath = fileURLToPath(
  new URL(
    "../src/data/snapshots/modern-journey-origin.v1.json",
    import.meta.url
  )
);
const origin = JSON.parse(await readFile(originPath, "utf8")).origin;
const seoulCityHall = { latitude: 37.5663, longitude: 126.9779 };
const gwanghwamun = { latitude: 37.5759, longitude: 126.9768 };

const seoulDistance = greatCircleDistanceMeters(origin, seoulCityHall);
const gwanghwamunDistance = greatCircleDistanceMeters(origin, gwanghwamun);

assert(
  Math.abs(seoulDistance - 125142.33475390976) < 1,
  "공주시청→서울시청 직선거리 계산이 다릅니다."
);
assert(
  Math.abs(gwanghwamunDistance - 126214.14069792727) < 1,
  "공주시청→광화문 직선거리 계산이 다릅니다."
);
assert(
  greatCircleDistanceMeters(seoulCityHall, seoulCityHall) === 0,
  "동일 좌표 거리는 0m여야 합니다."
);
assert(
  greatCircleDistanceMeters(
    { latitude: 91, longitude: 127 },
    seoulCityHall
  ) === null &&
    greatCircleDistanceMeters(
      { latitude: 37, longitude: 181 },
      seoulCityHall
    ) === null &&
    greatCircleDistanceMeters(
      { latitude: Number.NaN, longitude: 127 },
      seoulCityHall
    ) === null,
  "유효 범위를 벗어난 좌표는 거리를 반환할 수 없습니다."
);
assert(
  formatApproxDistance(seoulDistance) === "약 125km" &&
    formatApproxDistance(1_481) === "약 1.5km" &&
    formatApproxDistance(451) === "약 450m" &&
    formatApproxDistance(null) === "산출 전",
  "현대 직선거리 표시 반올림 기준이 다릅니다."
);

console.log("현대 직선거리 계산·유효범위·표시 검사를 통과했습니다.");
