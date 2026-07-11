import snapshotJson from "./snapshots/nmk-shinsu19997.v1.json";
import type {
  DemoPlace,
  EvidenceSnapshot,
  GyeolResultEnvelope
} from "../domain/gyeolEvidence";

export const bundledEvidenceSnapshot = snapshotJson as unknown as EvidenceSnapshot;

export function buildResultFromSnapshot(
  place: DemoPlace,
  snapshot: EvidenceSnapshot,
  warning?: string
): GyeolResultEnvelope {
  const apiWasSynced = snapshot.api.status === "synced" && snapshot.api.record !== null;
  const apiRecord = snapshot.api.record;

  return {
    artifact: snapshot.record,
    place,
    candidate: {
      name: "한양·한성부 권역 후보",
      hanja: "漢陽 · 漢城府",
      label: "권역 대응 추정",
      summary: `${place.label} 인근의 현대 위치를 역사적 권역에 대응하면 한양·한성부 권역 후보로 살펴볼 수 있습니다.`,
      limitation:
        "현대 좌표를 대동여지도 원본의 한 점으로 확정한 결과가 아닙니다. 현재는 공식 판본 정보와 로컬 임시 등록점을 사용한 권역 단위 해석입니다."
    },
    evidence: [
      {
        id: "edition",
        eyebrow: "판본 원문 근거",
        title: `${snapshot.record.title} · ${snapshot.record.edition}`,
        description: `${snapshot.record.creator} 제작 · ${snapshot.record.format} · 소장품번호 ${snapshot.record.collectionNumber}. ${snapshot.record.roadNotation}한 판본이며, 공식 갤러리 7번 화면은 도성도로 식별됩니다.`,
        status: "공식 원문 확인",
        claimStatus: "source-confirmed",
        sourceIds: ["nmk-collection-shinsu19997"],
        mapRegionId: "local-hanseong-provisional"
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
        description: `${place.adminLabel}의 위치를 한성부 관련 권역 후보와 대조한 시범 해석입니다. 지명 대응 규칙과 공식 판본의 첩·면 좌표는 추가 검수가 필요합니다.`,
        status: "권역 대응 추정",
        claimStatus: "regional-inference",
        sourceIds:
          place.id === "seoul-city-hall" ? ["seoul-gungisi-cityhall"] : []
      }
    ],
    sources: snapshot.sources,
    mapRegions: snapshot.mapRegions,
    delivery: {
      mode: apiWasSynced ? "cached-snapshot" : "curated-fallback",
      servedAt: new Date().toISOString(),
      snapshotCreatedAt: snapshot.snapshotCreatedAt,
      label: apiWasSynced ? "API 갱신 저장본" : "공식 원문 검수본",
      warning:
        warning ??
        (apiWasSynced
          ? "브라우저에 인증키를 노출하지 않기 위해 서버에서 갱신한 저장본을 표시합니다."
          : "공공데이터 API 인증키 연결 전이라 2026.07.11에 확인한 공식 원문 검수본을 표시합니다.")
    }
  };
}

export function buildCuratedFallback(place: DemoPlace, warning?: string) {
  return buildResultFromSnapshot(place, bundledEvidenceSnapshot, warning);
}
