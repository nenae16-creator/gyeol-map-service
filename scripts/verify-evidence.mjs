import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const snapshotPath = fileURLToPath(
  new URL("../src/data/snapshots/nmk-shinsu19997.v1.json", import.meta.url)
);
const snapshotText = await readFile(snapshotPath, "utf8");
const snapshot = JSON.parse(snapshotText);
const doseongdoPath = fileURLToPath(
  new URL(
    "../public/assets/official/nmk-shinsu19997-doseongdo-original.jpg",
    import.meta.url
  )
);
const provenancePath = fileURLToPath(
  new URL(
    "../public/assets/official/nmk-shinsu19997-doseongdo.provenance.json",
    import.meta.url
  )
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(snapshot.schemaVersion === 1, "지원하지 않는 근거 저장본 스키마입니다.");
assert(snapshot.record?.collectionNumber === "신수19997", "소장품번호가 신수19997이 아닙니다.");
assert(snapshot.api?.datasetId === "15159017", "공공데이터 GW 데이터셋 ID가 다릅니다.");
assert(!snapshotText.includes("serviceKey"), "저장본에 serviceKey 필드가 포함되어 있습니다.");
assert(
  !snapshotText.includes("DATA_GO_KR_SERVICE_KEY"),
  "저장본에 서버 환경변수 이름이 포함되어 있습니다."
);
assert(!/img(?:Thum)?Uri/i.test(snapshotText), "저장본에 외부 이미지 토큰 URL이 포함되어 있습니다.");

for (const source of snapshot.sources ?? []) {
  assert(source.id && source.recordUrl && source.accessedAt, "출처에 ID·URL·접근일이 필요합니다.");
  assert(source.license?.name && source.license?.url, "출처에 이용조건이 필요합니다.");
}

for (const region of snapshot.mapRegions ?? []) {
  const point = region.point;
  assert(point?.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1, "지도 점이 0~1 범위를 벗어났습니다.");

  if (region.bounds) {
    const bounds = region.bounds;
    assert(
      bounds.x >= 0 &&
        bounds.y >= 0 &&
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.x + bounds.width <= 1 &&
        bounds.y + bounds.height <= 1,
      "지도 bounds가 0~1 범위를 벗어났습니다."
    );
  }

  if (region.registrationStatus === "human-verified") {
    assert(region.reviewedAt && region.bounds, "사람 검수 좌표에는 검수일과 bounds가 필요합니다.");
  }
}

const doseongdoBytes = await readFile(doseongdoPath);
const doseongdoHash = createHash("sha256").update(doseongdoBytes).digest("hex").toUpperCase();
const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
assert(
  doseongdoHash === provenance.source?.sha256,
  "공식 도성도 원본 해시가 계보 문서와 일치하지 않습니다."
);
assert(
  provenance.rights?.licenseId === "KOGL-TYPE-1" &&
    provenance.rights?.rightsStatementUrl,
  "공식 도성도 계보에 제1유형 권리 근거가 없습니다."
);

for (const region of (snapshot.mapRegions ?? []).filter((item) =>
  item.mapId?.includes("doseongdo-original")
)) {
  assert(region.assetSha256 === doseongdoHash, `${region.id} 좌표가 다른 원본 해시를 참조합니다.`);
  assert(region.assetSpace?.width === 3000 && region.assetSpace?.height === 1825, `${region.id} 원본 좌표 공간이 다릅니다.`);
  assert(region.registrationStatus !== "human-verified", `${region.id} 추정 좌표를 사람 검수 완료로 표시할 수 없습니다.`);
}

assert(
  (snapshot.mapRegions ?? []).filter((region) =>
    region.mapId?.includes("doseongdo-original")
  ).length === 3,
  "도성도 시범 장소 좌표는 서울시청·광화문·경복궁 3개여야 합니다."
);
assert(
  (snapshot.sources ?? []).some((source) => source.id === "seoul-gungisi-cityhall"),
  "서울시청 현대 위치 추정의 군기시 보조 출처가 없습니다."
);

if (snapshot.api.status === "synced") {
  assert(snapshot.api.record?.collectionNumber === "신수19997", "API 저장본 소장품번호가 다릅니다.");
}

const distPath = `${root}dist`;
try {
  await access(distPath, constants.R_OK);
  const distDoseongdoPath = `${distPath}\\assets\\official\\nmk-shinsu19997-doseongdo-original.jpg`;
  const distDoseongdoHash = createHash("sha256")
    .update(await readFile(distDoseongdoPath))
    .digest("hex")
    .toUpperCase();
  assert(
    distDoseongdoHash === doseongdoHash,
    "배포 결과의 공식 도성도 원본 해시가 변경됐습니다."
  );
  const files = await readdir(distPath, { recursive: true, withFileTypes: true });

  for (const file of files) {
    if (!file.isFile() || !/\.(?:html|js|json)$/i.test(file.name)) continue;
    const fullPath = `${file.parentPath ?? file.path}\\${file.name}`;
    const content = await readFile(fullPath, "utf8");
    assert(!content.includes("DATA_GO_KR_SERVICE_KEY"), `클라이언트 결과물에 서버 키 이름이 포함됐습니다: ${file.name}`);
    assert(!content.includes("serviceKey"), `클라이언트 결과물에 API 키 매개변수가 포함됐습니다: ${file.name}`);
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

console.log("근거 저장본·좌표·클라이언트 키 노출 검사를 통과했습니다.");
