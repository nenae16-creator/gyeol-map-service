import snapshotJson from "./snapshots/nmk-shinsu19997.v1.json";
import type {
  DemoPlace,
  EvidenceSnapshot,
  GyeolResultEnvelope
} from "../domain/gyeolEvidence";
import { getDemoRegionProfile } from "./gyeolDemo";

export const bundledEvidenceSnapshot = snapshotJson as unknown as EvidenceSnapshot;

export function buildResultFromSnapshot(
  place: DemoPlace,
  snapshot: EvidenceSnapshot,
  warning?: string
): GyeolResultEnvelope {
  const apiWasSynced = snapshot.api.status === "synced" && snapshot.api.record !== null;
  const apiRecord = snapshot.api.record;
  const profile = getDemoRegionProfile(place.regionId);
  const inferenceSourceIds = [...profile.inferenceSourceIds];

  if (
    (place.canonicalPlaceId ?? place.id) === "seoul-city-hall" &&
    !inferenceSourceIds.includes("seoul-gungisi-cityhall")
  ) {
    inferenceSourceIds.push("seoul-gungisi-cityhall");
  }

  return {
    artifact: snapshot.record,
    place,
    candidate: {
      name: profile.candidate.name,
      hanja: profile.candidate.hanja,
      label: profile.candidate.label,
      summary: profile.candidate.summary(place),
      limitation: profile.candidate.limitation
    },
    evidence: [
      {
        id: "edition",
        eyebrow: "판본 원문 근거",
        title: `${profile.editionEvidence.title} · ${snapshot.record.edition}`,
        description: `${snapshot.record.creator} 제작 · 소장품번호 ${snapshot.record.collectionNumber}. ${profile.editionEvidence.description(place)}`,
        status: "공식 원문 확인",
        claimStatus: "source-confirmed",
        sourceIds: ["nmk-collection-shinsu19997"],
        mapRegionId: profile.editionEvidence.mapRegionId
      },
      {
        id: "public-data",
        eyebrow: "공공데이터 전달 상태",
        title: apiWasSynced
          ? `${apiRecord?.name ?? snapshot.record.title} API 저장본`
          : "전국 박물관 유물정보_GW 연결 정보",
        description: apiWasSynced
          ? `공공데이터 API에서 소장품번호 ${apiRecord?.collectionNumber} 레코드를 확인해 서버 측 저장본으로 정규화했습니다.`
          : "공식 API의 목록·상세·이미지 조회 명세를 연결했습니다. 인증키가 없는 현재 화면은 국립중앙박물관 원문을 검수한 저장 근거를 사용합니다.",
        status: apiWasSynced ? "공공데이터 저장본" : "API 연결 준비",
        claimStatus: apiWasSynced ? "api-snapshot-confirmed" : "source-confirmed",
        sourceIds: ["data-go-emuseum-gw"]
      },
      {
        id: "inference",
        eyebrow: "추정 안내",
        title: "현대 위치와 역사 권역의 대응",
        description: profile.inferenceDescription(place),
        status: "권역 대응 추정",
        claimStatus: "regional-inference",
        sourceIds: inferenceSourceIds
      }
    ],
    sources: snapshot.sources,
    mapRegions: snapshot.mapRegions,
    experience: profile.experience,
    delivery: {
      mode: apiWasSynced ? "cached-snapshot" : "curated-fallback",
      servedAt: new Date().toISOString(),
      snapshotCreatedAt: snapshot.snapshotCreatedAt,
      label: apiWasSynced ? "API 갱신 저장본" : "공식 원문 검수본",
      warning:
        warning ??
        (apiWasSynced
          ? "브라우저에 인증키를 노출하지 않기 위해 서버에서 갱신한 저장본을 표시합니다."
          : "공공데이터 API 인증키 연결 전이라 앱에 포함된 공식 원문 검수본을 표시합니다.")
    }
  };
}

export function buildCuratedFallback(place: DemoPlace, warning?: string) {
  return buildResultFromSnapshot(place, bundledEvidenceSnapshot, warning);
}
