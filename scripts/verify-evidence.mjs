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
const modernJourneyPath = fileURLToPath(
  new URL(
    "../src/data/snapshots/modern-journey-origin.v1.json",
    import.meta.url
  )
);
const modernJourneyText = await readFile(modernJourneyPath, "utf8");
const modernJourney = JSON.parse(modernJourneyText);
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
const cheonanSheetPath = fileURLToPath(
  new URL(
    "../public/assets/official/nmk-shinsu19997-cheonan-sheet-96-original.jpg",
    import.meta.url
  )
);
const cheonanProvenancePath = fileURLToPath(
  new URL(
    "../public/assets/official/nmk-shinsu19997-cheonan-sheet-96.provenance.json",
    import.meta.url
  )
);
const CHEONAN_SHEET_SHA256 =
  "CCCC9342B409E5BC242D04CD275370C7EFEE2AAB56BE56324871895ABE9B087D";
const CHEONAN_INFERENCE_SOURCE_IDS = [
  "korail-cheonan-station-location",
  "kr-cheonan-station-record",
  "cheonan-city-history"
];

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
assert(
  !/[?&](?:serviceKey|apiKey|accessToken|authToken)=/i.test(snapshotText),
  "저장본에 인증 토큰이 포함된 URL이 있습니다."
);
assert(modernJourney.schemaVersion === 1, "현대 거리 기준점 스키마가 다릅니다.");
assert(
  modernJourney.origin?.id === "gongju-city-hall" &&
    modernJourney.origin?.label === "공주시청",
  "현대 거리 출발 기준점이 공주시청이 아닙니다."
);
assert(
  modernJourney.origin?.latitude >= -90 &&
    modernJourney.origin?.latitude <= 90 &&
    modernJourney.origin?.longitude >= -180 &&
    modernJourney.origin?.longitude <= 180 &&
    modernJourney.origin?.latitude === 36.446542105093314 &&
    modernJourney.origin?.longitude === 127.11922678155355,
  "공주시청 현대 좌표가 WGS84 범위를 벗어났습니다."
);
assert(
  /^https:\/\/www\.gongju\.go\.kr\//.test(
    modernJourney.origin?.addressSourceUrl ?? ""
  ) &&
    /^https:\/\/www\.gongju\.go\.kr\//.test(
      modernJourney.origin?.coordinateSourceUrl ?? ""
    ) &&
    modernJourney.origin?.accessedAt,
  "공주시청 현대 좌표에 주소·좌표 출처와 접근일이 필요합니다."
);
assert(
  modernJourney.distanceMethod?.id === "great-circle" &&
    modernJourney.distanceMethod?.earthRadiusMeters === 6371008.8 &&
    modernJourney.distanceMethod?.displayQualifier === "approximate",
  "현대 직선거리 계산·표시 기준이 다릅니다."
);
assert(
  !/serviceKey|DATA_GO_KR_SERVICE_KEY/.test(modernJourneyText),
  "현대 거리 기준점 저장본에 API 키 필드가 포함되어 있습니다."
);

for (const source of snapshot.sources ?? []) {
  assert(source.id && source.recordUrl && source.accessedAt, "출처에 ID·URL·접근일이 필요합니다.");
  assert(source.license?.name && source.license?.url, "출처에 이용조건이 필요합니다.");
}

const sourceIds = new Set((snapshot.sources ?? []).map((source) => source.id));
assert(
  sourceIds.size === (snapshot.sources ?? []).length,
  "근거 저장본에 중복된 출처 ID가 있습니다."
);

for (const region of snapshot.mapRegions ?? []) {
  const point = region.point;
  assert(point?.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1, "지도 점이 0~1 범위를 벗어났습니다.");
  assert(
    /^\/assets\//.test(region.assetPath ?? "") &&
      !(region.assetPath ?? "").includes("..") &&
      region.assetSpace?.width > 0 &&
      region.assetSpace?.height > 0,
    `${region.id}의 로컬 자산 경로나 좌표 공간이 올바르지 않습니다.`
  );

  if (region.bounds) {
    const bounds = region.bounds;
    assert(
      bounds.x >= 0 &&
        bounds.y >= 0 &&
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.x + bounds.width <= 1 &&
        bounds.y + bounds.height <= 1 &&
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height,
      "지도 bounds가 범위를 벗어났거나 등록점을 포함하지 않습니다."
    );
  }

  if (region.registrationStatus === "human-verified") {
    assert(region.reviewedAt && region.bounds, "사람 검수 좌표에는 검수일과 bounds가 필요합니다.");
  }

  for (const sourceId of region.sourceIds ?? []) {
    assert(sourceIds.has(sourceId), `${region.id}가 존재하지 않는 출처 ${sourceId}를 참조합니다.`);
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

const cheonanImage = (snapshot.record?.images ?? []).find(
  (image) => image.id === "nmk-shinsu19997-cheonan-sheet-96"
);
assert(cheonanImage, "천안 공식 이미지 파일 96 메타데이터가 없습니다.");
assert(
  cheonanImage.galleryIndex === 95 &&
    cheonanImage.fileName === "ssu019997-00-96.jpg" &&
    cheonanImage.width === 3000 &&
    cheonanImage.height === 1794,
  "천안 공식 이미지 파일 96 식별자나 원본 크기가 다릅니다."
);
assert(
  cheonanImage.imageUrl ===
    "https://www.museum.go.kr/relic_image/PS01001001/ssu019/2018/0723134130201/ssu019997-00-96.jpg" &&
    cheonanImage.localAssetPath ===
      "/assets/official/nmk-shinsu19997-cheonan-sheet-96-original.jpg" &&
    cheonanImage.sha256 === CHEONAN_SHEET_SHA256 &&
    cheonanImage.rightsSourceId === "nmk-collection-shinsu19997",
  "천안 공식 이미지 파일 96이 로컬 자산·해시·권리 출처와 연결되지 않았습니다."
);

const korailSource = (snapshot.sources ?? []).find(
  (source) => source.id === "korail-cheonan-station-location"
);
assert(
  korailSource?.datasetId === "15127532" &&
    korailSource.recordUrl ===
      "https://www.data.go.kr/data/15127532/fileData.do?recommendDataYn=Y" &&
    korailSource.coordinates?.placeId === "cheonan-station" &&
    korailSource.coordinates?.crs === "WGS84" &&
    korailSource.coordinates?.latitude === 36.808837 &&
    korailSource.coordinates?.longitude === 127.1471716 &&
    korailSource.license?.name === "이용허락범위 제한 없음",
  "한국철도공사 천안역 좌표 근거가 정확히 등록되지 않았습니다."
);

const cheonanHistorySource = (snapshot.sources ?? []).find(
  (source) => source.id === "cheonan-city-history"
);

const railNetworkSource = (snapshot.sources ?? []).find(
  (source) => source.id === "kr-cheonan-station-record"
);
assert(
  railNetworkSource?.datasetId === "15067652" &&
    railNetworkSource.recordUrl ===
      "https://www.data.go.kr/data/15067652/fileData.do" &&
    railNetworkSource.coordinates?.placeId === "cheonan-station" &&
    railNetworkSource.coordinates?.latitude === 36.809452 &&
    railNetworkSource.coordinates?.longitude === 127.147055 &&
    railNetworkSource.addressFact?.address ===
      "충청남도 천안시 동남구 대흥로 239" &&
    railNetworkSource.openingFact?.openedAt === "1905-01-01" &&
    railNetworkSource.license?.name === "이용허락범위 제한 없음",
  "국가철도공단 천안역 주소·좌표·개업일 근거가 정확히 등록되지 않았습니다."
);
assert(
  cheonanHistorySource?.recordUrl ===
    "https://www.cheonan.go.kr/kor/sub04_01_01.do" &&
    cheonanHistorySource.historicalFact?.year === 1416 &&
    cheonanHistorySource.historicalFact?.historicalName === "천안군",
  "천안시 연혁의 1416년 천안군 근거가 정확히 등록되지 않았습니다."
);

assert(
  CHEONAN_INFERENCE_SOURCE_IDS.every((sourceId) => sourceIds.has(sourceId)),
  "천안 권역 추정에 필요한 공식 출처가 모두 등록되지 않았습니다."
);

const localCheonanRegion = (snapshot.mapRegions ?? []).find(
  (region) => region.id === "local-cheonan-provisional"
);
assert(localCheonanRegion, "전체지도 천안 권역 등록점이 없습니다.");
assert(
  localCheonanRegion.modernPlaceId === "cheonan-station" &&
    localCheonanRegion.mapId === "local-daedongyeojido-visual-v2" &&
    localCheonanRegion.point?.x === 0.369 &&
    localCheonanRegion.point?.y === 0.507 &&
    localCheonanRegion.bounds?.x === 0.319 &&
    localCheonanRegion.bounds?.y === 0.467 &&
    localCheonanRegion.bounds?.width === 0.1 &&
    localCheonanRegion.bounds?.height === 0.08 &&
    localCheonanRegion.registrationStatus === "approximate",
  "전체지도 천안 권역의 근사 좌표·bounds·상태가 다릅니다."
);

const cheonanSheetRegion = (snapshot.mapRegions ?? []).find(
  (region) => region.id === "nmk-cheonan-label-estimate"
);
assert(cheonanSheetRegion, "공식 판면의 천안 표기 등록점이 없습니다.");
assert(
  cheonanSheetRegion.modernPlaceId === undefined &&
    cheonanSheetRegion.mapId === "nmk-shinsu19997-img96-cheonan-original" &&
    cheonanSheetRegion.imageId === cheonanImage.id &&
    cheonanSheetRegion.assetPath === cheonanImage.localAssetPath &&
    cheonanSheetRegion.assetSha256 === CHEONAN_SHEET_SHA256 &&
    cheonanSheetRegion.assetSpace?.width === 3000 &&
    cheonanSheetRegion.assetSpace?.height === 1794 &&
    cheonanSheetRegion.point?.x === 0.457333 &&
    cheonanSheetRegion.point?.y === 0.604236 &&
    cheonanSheetRegion.bounds?.x === 0.32 &&
    cheonanSheetRegion.bounds?.y === 0.36 &&
    cheonanSheetRegion.bounds?.width === 0.3 &&
    cheonanSheetRegion.bounds?.height === 0.48 &&
    cheonanSheetRegion.registrationStatus === "approximate",
  "공식 판면 천안 표기의 자산 교차참조·좌표·bounds·상태가 다릅니다."
);

const requiredCheonanRegionSources = [
  "nmk-collection-shinsu19997",
  ...CHEONAN_INFERENCE_SOURCE_IDS
];
assert(
  requiredCheonanRegionSources.every((sourceId) =>
    localCheonanRegion.sourceIds?.includes(sourceId)
  ),
  "전체지도 천안 권역 추정에 공식 출처 교차참조가 부족합니다."
);
assert(
  cheonanSheetRegion.sourceIds?.length === 1 &&
    cheonanSheetRegion.sourceIds[0] === "nmk-collection-shinsu19997",
  "역사 판면 영역은 박물관 판본 출처만 참조해야 합니다."
);

const cheonanSheetBytes = await readFile(cheonanSheetPath);
const cheonanSheetHash = createHash("sha256")
  .update(cheonanSheetBytes)
  .digest("hex")
  .toUpperCase();
const cheonanProvenanceText = await readFile(cheonanProvenancePath, "utf8");
const cheonanProvenance = JSON.parse(cheonanProvenanceText);
assert(
  cheonanSheetBytes.byteLength === 5744880 &&
    cheonanSheetHash === CHEONAN_SHEET_SHA256,
  "천안 공식 이미지 파일 96의 크기 또는 SHA-256이 다릅니다."
);
assert(
  cheonanProvenance.artifactId === "nmk-shinsu19997-img96-cheonan-original" &&
    cheonanProvenance.source?.recordId === "신수19997" &&
    cheonanProvenance.source?.originalFileName === "ssu019997-00-96.jpg" &&
    cheonanProvenance.source?.imageUrl === cheonanImage.imageUrl &&
    cheonanProvenance.source?.byteLength === 5744880 &&
    cheonanProvenance.source?.sha256 === cheonanSheetHash &&
    cheonanProvenance.source?.width === 3000 &&
    cheonanProvenance.source?.height === 1794 &&
    cheonanProvenance.localAsset?.publicPath === cheonanImage.localAssetPath,
  "천안 공식 이미지 파일 96 계보가 공식 레코드·원본 파일·로컬 자산과 일치하지 않습니다."
);
assert(
  cheonanProvenance.rights?.licenseId === "KOGL-TYPE-1" &&
    cheonanProvenance.rights?.rightsStatementUrl ===
      "https://www.museum.go.kr/site/main/relic/search/view?relicId=4502",
  "천안 공식 이미지 파일 96 계보에 공공누리 제1유형 권리 근거가 없습니다."
);
assert(
  !/[?&](?:serviceKey|apiKey|accessToken|authToken)=|img(?:Thum)?Uri/i.test(
    cheonanProvenanceText
  ),
  "천안 공식 이미지 파일 96 계보에 이미지 API 토큰 URL이 포함되어 있습니다."
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
  const distCheonanSheetPath = `${distPath}\\assets\\official\\nmk-shinsu19997-cheonan-sheet-96-original.jpg`;
  const distCheonanSheetBytes = await readFile(distCheonanSheetPath);
  const distCheonanSheetHash = createHash("sha256")
    .update(distCheonanSheetBytes)
    .digest("hex")
    .toUpperCase();
  assert(
    distCheonanSheetBytes.byteLength === 5744880 &&
      distCheonanSheetHash === cheonanSheetHash,
    "배포 결과의 천안 공식 이미지 파일 96 크기 또는 해시가 변경됐습니다."
  );
  const files = await readdir(distPath, { recursive: true, withFileTypes: true });

  for (const file of files) {
    if (!file.isFile() || !/\.(?:html|js|json)$/i.test(file.name)) continue;
    const fullPath = `${file.parentPath ?? file.path}\\${file.name}`;
    const content = await readFile(fullPath, "utf8");
    assert(!content.includes("DATA_GO_KR_SERVICE_KEY"), `클라이언트 결과물에 서버 키 이름이 포함됐습니다: ${file.name}`);
    assert(!content.includes("KAKAO_MOBILITY_REST_API_KEY"), `클라이언트 결과물에 길찾기 서버 키 이름이 포함됐습니다: ${file.name}`);
    assert(!content.includes("serviceKey"), `클라이언트 결과물에 API 키 매개변수가 포함됐습니다: ${file.name}`);
    assert(!content.includes("KakaoAK"), `클라이언트 결과물에 길찾기 인증 방식이 포함됐습니다: ${file.name}`);
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

console.log("근거 저장본·좌표·클라이언트 키 노출 검사를 통과했습니다.");
