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
  const firstRegion = snapshot.mapRegions?.[0];
  if (!firstRegion) return false;

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
    firstRegion.collectionNumber === "신수19997" &&
    firstRegion.point.x >= 0 &&
    firstRegion.point.x <= 1 &&
    firstRegion.point.y >= 0 &&
    firstRegion.point.y <= 1 &&
    (!firstRegion.bounds || isNormalizedBounds(firstRegion.bounds)) &&
    (firstRegion.registrationStatus !== "human-verified" || Boolean(firstRegion.reviewedAt))
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
      "데이터 저장본을 불러오지 못해 앱에 포함된 2026.07.11 공식 원문 검수본을 사용했습니다."
    );
  } finally {
    window.clearTimeout(timer);
  }
}
