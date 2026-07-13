import snapshotUrl from "./snapshots/nmk-shinsu19997.v1.json?url";
import type { DemoPlace, EvidenceSnapshot } from "../domain/gyeolEvidence";
import { isNormalizedBounds } from "../domain/gyeolEvidence";
import {
  buildCuratedFallback,
  buildResultFromSnapshot
} from "./gyeolFallback";

const SNAPSHOT_TIMEOUT_MS = 2500;

function isEvidenceSnapshot(value: unknown): value is EvidenceSnapshot {
  if (!value || typeof value !== "object") return false;

  const snapshot = value as Partial<EvidenceSnapshot>;
  const regions = snapshot.mapRegions;
  if (!Array.isArray(regions) || regions.length === 0) return false;

  const requiredRegionIds = [
    "local-hanseong-provisional",
    "local-cheonan-provisional",
    "nmk-cheonan-label-estimate"
  ];
  const requiredSourceIds = [
    "nmk-collection-shinsu19997",
    "korail-cheonan-station-location",
    "kr-cheonan-station-record",
    "cheonan-city-history"
  ];
  const sourceIds = new Set(snapshot.sources?.map((source) => source.id));
  const regionsAreValid = regions.every(
    (region) =>
      region.collectionNumber === "신수19997" &&
      region.assetPath.startsWith("/assets/") &&
      !region.assetPath.includes("..") &&
      region.assetSpace.width > 0 &&
      region.assetSpace.height > 0 &&
      region.point.x >= 0 &&
      region.point.x <= 1 &&
      region.point.y >= 0 &&
      region.point.y <= 1 &&
      (!region.bounds ||
        (isNormalizedBounds(region.bounds) &&
          region.point.x >= region.bounds.x &&
          region.point.x <= region.bounds.x + region.bounds.width &&
          region.point.y >= region.bounds.y &&
          region.point.y <= region.bounds.y + region.bounds.height)) &&
      (region.registrationStatus !== "human-verified" || Boolean(region.reviewedAt)) &&
      (region.sourceIds?.every((id) => sourceIds.has(id)) ?? true)
  );
  const cheonanDetailRegion = regions.find(
    (region) => region.id === "nmk-cheonan-label-estimate"
  );

  return (
    snapshot.schemaVersion === 1 &&
    snapshot.record?.collectionNumber === "신수19997" &&
    snapshot.api?.datasetId === "15159017" &&
    (snapshot.api.status === "credential-required" || snapshot.api.status === "synced") &&
    Array.isArray(snapshot.sources) &&
    snapshot.sources.some(
      (source) =>
        source.id === "nmk-collection-shinsu19997" &&
        source.recordId === "신수19997" &&
        Boolean(source.accessedAt)
    ) &&
    requiredSourceIds.every((id) => sourceIds.has(id)) &&
    requiredRegionIds.every((id) => regions.some((region) => region.id === id)) &&
    Boolean(cheonanDetailRegion?.bounds) &&
    regionsAreValid
  );
}

export async function resolveGyeolResult(place: DemoPlace) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), SNAPSHOT_TIMEOUT_MS);

  try {
    const response = await fetch(snapshotUrl, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });

    if (!response.ok) throw new Error(`snapshot-http-${response.status}`);

    const snapshot: unknown = await response.json();
    if (!isEvidenceSnapshot(snapshot)) throw new Error("snapshot-schema-invalid");

    return buildResultFromSnapshot(place, snapshot);
  } catch {
    return buildCuratedFallback(
      place,
      "데이터 저장본을 불러오지 못해 앱에 포함된 공식 원문 검수본을 사용했습니다."
    );
  } finally {
    window.clearTimeout(timer);
  }
}
