import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";

const snapshotPath = fileURLToPath(
  new URL("../src/data/snapshots/nmk-shinsu19997.v1.json", import.meta.url)
);
const rawServiceKey = process.env.DATA_GO_KR_SERVICE_KEY?.trim();

if (!rawServiceKey) {
  console.error(
    "DATA_GO_KR_SERVICE_KEY가 없습니다. 공공데이터포털에서 발급한 키를 서버 환경변수로 설정해 주세요."
  );
  process.exit(1);
}

const serviceKey = decodeServiceKey(rawServiceKey);
const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true
});

function decodeServiceKey(value) {
  if (!value.includes("%")) return value;

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function firstValueByKey(node, targetKey) {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = firstValueByKey(item, targetKey);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  if (!node || typeof node !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(node, targetKey)) return node[targetKey];

  for (const value of Object.values(node)) {
    const found = firstValueByKey(value, targetKey);
    if (found !== undefined) return found;
  }

  return undefined;
}

function keyValueRecord(node) {
  if (!node || typeof node !== "object" || !("item" in node)) return undefined;

  const items = Array.isArray(node.item) ? node.item : [node.item];
  const record = {};

  for (const item of items) {
    const key = item?.["@_key"];
    if (typeof key === "string") record[key] = item["@_value"] ?? "";
  }

  return Object.keys(record).length ? record : undefined;
}

function collectRelicRecords(node, output = []) {
  if (Array.isArray(node)) {
    node.forEach((item) => collectRelicRecords(item, output));
    return output;
  }

  if (!node || typeof node !== "object") return output;

  const flattened = keyValueRecord(node) ?? node;
  if ("id" in flattened && "relicNo" in flattened) output.push(flattened);
  Object.values(node).forEach((value) => collectRelicRecords(value, output));
  return output;
}

function collectImageRecords(node, output = []) {
  if (Array.isArray(node)) {
    node.forEach((item) => collectImageRecords(item, output));
    return output;
  }

  if (!node || typeof node !== "object") return output;

  const flattened = keyValueRecord(node) ?? node;
  if ("imgId" in flattened || "imgOrder" in flattened) output.push(flattened);
  Object.values(node).forEach((value) => collectImageRecords(value, output));
  return output;
}

function normalizedRelicNumber(value) {
  return text(value, 100)?.replace(/\s/g, "").replace(/^0+(?=\d)/, "");
}

function text(value, maxLength = 5000) {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function safeDiagnostic(value) {
  const normalized = text(value, 240);
  if (!normalized) return undefined;

  return normalized
    .replaceAll(rawServiceKey, "[REDACTED]")
    .replaceAll(serviceKey, "[REDACTED]")
    .replace(/serviceKey\s*[=:]\s*[^\s<]+/gi, "serviceKey=[REDACTED]");
}

function joinDefined(values) {
  const result = values.map((value) => text(value, 500)).filter(Boolean);
  return result.length ? result.join(" · ") : undefined;
}

async function requestApi(pathname, parameters) {
  const url = new URL(`https://apis.data.go.kr/1371027/openapi/${pathname}`);
  url.searchParams.set("serviceKey", serviceKey);

  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/xml" }
    });

    const body = await response.text();
    if (body.length > 8_000_000) throw new Error("공공데이터 API 응답 크기가 제한을 초과했습니다.");

    const parsed = parser.parse(body);
    if (!response.ok) {
      const errorCode = safeDiagnostic(
        firstValueByKey(parsed, "returnReasonCode") ??
          firstValueByKey(parsed, "resultCode") ??
          firstValueByKey(parsed, "errCode")
      );
      const errorMessage = safeDiagnostic(
        firstValueByKey(parsed, "returnAuthMsg") ??
          firstValueByKey(parsed, "resultMsg") ??
          firstValueByKey(parsed, "errMsg")
      );
      const detail = [errorCode, errorMessage].filter(Boolean).join(" · ");
      throw new Error(
        `공공데이터 API HTTP ${response.status}${detail ? ` · ${detail}` : ""}`
      );
    }

    const resultCode = text(firstValueByKey(parsed, "resultCode"), 20);
    if (resultCode && !["00", "0000"].includes(resultCode)) {
      throw new Error(`공공데이터 API 결과 코드 ${resultCode}`);
    }

    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

const expectedId = "PS0100100101101999700000";
const listResponse = await requestApi("list", {
  pageNo: 1,
  numOfRows: 10,
  museumCode: "PS01001001011",
  nameKr: "대동여지도"
});
const listRecords = collectRelicRecords(listResponse);
const matched = listRecords.find(
  (record) =>
    text(record.id) === expectedId &&
    normalizedRelicNumber(record.relicNo) === "19997" &&
    text(record.museumName3)?.replace(/\s/g, "") === "신수"
);

if (!matched?.id) {
  throw new Error("API 목록에서 e뮤지엄 대동여지도 신수19997 레코드를 찾지 못했습니다. 저장본은 변경하지 않았습니다.");
}

const detailResponse = await requestApi("detail", { id: matched.id });
const detailRecord =
  collectRelicRecords(detailResponse).find(
    (record) =>
      text(record.id) === expectedId &&
      normalizedRelicNumber(record.relicNo) === "19997" &&
      text(record.museumName3)?.replace(/\s/g, "") === "신수"
  ) ?? matched;
const imageRoot = firstValueByKey(detailResponse, "imageList");
const imageCountFromResponse = Number(firstValueByKey(imageRoot, "totalCount"));
const imageCount = Number.isFinite(imageCountFromResponse)
  ? imageCountFromResponse
  : new Set(collectImageRecords(imageRoot).map((image) => text(image.imgId)).filter(Boolean)).size;
const syncedAt = new Date().toISOString();
const accessedAt = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));

if (snapshot.schemaVersion !== 1 || snapshot.record?.collectionNumber !== "신수19997") {
  throw new Error("로컬 근거 저장본 스키마가 올바르지 않습니다. 저장본은 변경하지 않았습니다.");
}

const normalizedRecord = {
  id: text(detailRecord.id, 200),
  name: text(detailRecord.nameKr ?? detailRecord.name, 500) ?? "대동여지도",
  nameHanja: text(detailRecord.nameCn, 500),
  creator: text(detailRecord.author, 500),
  collectionNumber: "신수19997",
  museum: text(detailRecord.museumName2 ?? detailRecord.museumName1, 500),
  nationalityPeriod: joinDefined([
    detailRecord.nationalityName1,
    detailRecord.nationalityName2
  ]),
  material: joinDefined([detailRecord.materialName1, detailRecord.materialName2]),
  sizeInfo: text(detailRecord.sizeInfo, 1000),
  description: text(detailRecord.desc),
  imageCount,
  rightsCode: text(detailRecord.glsv, 50),
  syncedAt
};

for (const key of Object.keys(normalizedRecord)) {
  if (normalizedRecord[key] === undefined) delete normalizedRecord[key];
}

snapshot.snapshotCreatedAt = syncedAt;
snapshot.api.status = "synced";
snapshot.api.record = normalizedRecord;

const dataSource = snapshot.sources.find((source) => source.id === "data-go-emuseum-gw");
if (dataSource) dataSource.accessedAt = accessedAt;

await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(
  `공공데이터 저장본을 갱신했습니다: ${normalizedRecord.name} · ${normalizedRecord.collectionNumber} · ${accessedAt}`
);
