import type {
  DemoExperience,
  DemoPlace,
  DemoRegionId
} from "../domain/gyeolEvidence";

export type { DemoPlace } from "../domain/gyeolEvidence";

export type DemoRegionProfile = {
  id: DemoRegionId;
  label: string;
  candidate: {
    name: string;
    hanja: string;
    label: "권역 대응 추정";
    summary: (place: DemoPlace) => string;
    limitation: string;
  };
  editionEvidence: {
    title: string;
    description: (place: DemoPlace) => string;
    mapRegionId: string;
  };
  inferenceDescription: (place: DemoPlace) => string;
  inferenceSourceIds: string[];
  experience: DemoExperience;
  geofence: {
    latitude: number;
    longitude: number;
    latitudeTolerance: number;
    longitudeTolerance: number;
    proxyPlaceId: string;
  };
};

export const DEFAULT_DEMO_PLACE_ID = "cheonan-station";

export const demoRegionProfiles: Record<DemoRegionId, DemoRegionProfile> = {
  hanseong: {
    id: "hanseong",
    label: "서울 도성권",
    candidate: {
      name: "한양·한성부 권역 후보",
      hanja: "漢陽 · 漢城府",
      label: "권역 대응 추정",
      summary: (place) =>
        `${place.label} 인근의 현대 위치를 역사적 권역에 대응하면 한양·한성부 권역 후보로 살펴볼 수 있습니다.`,
      limitation:
        "현대 좌표를 대동여지도 원본의 한 점으로 확정한 결과가 아닙니다. 현재는 공식 판본 정보와 로컬 임시 등록점을 사용한 권역 단위 해석입니다."
    },
    editionEvidence: {
      title: "도성도와 한성부 권역",
      description: (place) =>
        `${place.label}과 대응하는 서울 도성권은 공식 갤러리 7번 도성도와 전체 대동여지도 판본을 함께 확인한 시범 해석입니다.`,
      mapRegionId: "local-hanseong-provisional"
    },
    inferenceDescription: (place) =>
      `${place.adminLabel}의 위치를 한성부 관련 권역 후보와 대조한 시범 해석입니다. 지명 대응 규칙과 공식 판본의 첩·면 좌표는 추가 검수가 필요합니다.`,
    inferenceSourceIds: [],
    experience: {
      wholeMapRegionId: "local-hanseong-provisional",
      journey: {
        kind: "doseongdo-walk",
        buttonLabel: "한성부 권역 지도 체험하기",
        ariaLabel: "한성부 권역 지도 체험"
      }
    },
    geofence: {
      latitude: 37.572,
      longitude: 126.978,
      latitudeTolerance: 0.03,
      longitudeTolerance: 0.03,
      proxyPlaceId: "seoul-city-hall"
    }
  },
  cheonan: {
    id: "cheonan",
    label: "천안군 권역",
    candidate: {
      name: "천안군 권역 후보",
      hanja: "天安郡",
      label: "권역 대응 추정",
      summary: (place) =>
        `${place.label}의 현대 위치를 1861년 대동여지도와 대조하면 천안(天安) 표기 주변의 천안군 권역 후보로 살펴볼 수 있습니다.`,
      limitation:
        "국가철도공단 기록상 천안역은 1905년에 개업해 대동여지도 제작 이후 생긴 시설입니다. 판본의 천안 표기와 현대 역 좌표를 같은 점으로 확정하지 않고 권역 수준으로만 대응합니다."
    },
    editionEvidence: {
      title: "공식 판본의 천안(天安) 표기",
      description: () =>
        "국립중앙박물관 대동여지도 신유본의 공식 이미지 파일 96에서 천안(天安) 표기를 시각 확인했습니다.",
      mapRegionId: "nmk-cheonan-label-estimate"
    },
    inferenceDescription: (place) =>
      place.canonicalPlaceId
        ? "현재 위치가 천안역 시범 범위 안에 있어, 판별 기준인 한국철도공사 천안역 대표점, 국가철도공단의 1905년 개업 기록, 천안시 공식 연혁과 대동여지도 판본의 천안 표기를 대조했습니다. 사용자 좌표 자체를 고지도 점과 연결한 것은 아닙니다."
        : `${place.adminLabel}의 한국철도공사 역 대표점, 국가철도공단의 1905년 개업 기록, 천안시 공식 연혁과 대동여지도 판본의 천안 표기를 함께 대조했습니다. 두 좌표계는 지오리퍼런싱되지 않았으므로 권역 후보로만 제시합니다.`,
    inferenceSourceIds: [
      "korail-cheonan-station-location",
      "kr-cheonan-station-record",
      "cheonan-city-history"
    ],
    experience: {
      wholeMapRegionId: "local-cheonan-provisional",
      journey: {
        kind: "regional-zoom",
        buttonLabel: "천안군 권역 판본 확대하기",
        ariaLabel: "대동여지도 공식 판본에서 천안군 권역 후보 확대",
        mapRegionId: "nmk-cheonan-label-estimate"
      }
    },
    geofence: {
      latitude: 36.808837,
      longitude: 127.1471716,
      latitudeTolerance: 0.03,
      longitudeTolerance: 0.03,
      proxyPlaceId: "cheonan-station"
    }
  }
};

export const demoPlaces: DemoPlace[] = [
  {
    id: "seoul-city-hall",
    regionId: "hanseong",
    label: "서울시청",
    adminLabel: "서울특별시 중구 세종대로",
    latitude: 37.5663,
    longitude: 126.9779,
    aliases: ["서울 시청", "시청", "서울특별시청"]
  },
  {
    id: "gwanghwamun",
    regionId: "hanseong",
    label: "광화문",
    adminLabel: "서울특별시 종로구 세종로",
    latitude: 37.5759,
    longitude: 126.9768,
    aliases: ["광화문광장", "광화문 광장"]
  },
  {
    id: "gyeongbokgung",
    regionId: "hanseong",
    label: "경복궁",
    adminLabel: "서울특별시 종로구 사직로",
    latitude: 37.5796,
    longitude: 126.977,
    aliases: ["경복궁역", "경복궁 궁궐"]
  },
  {
    id: "cheonan-station",
    regionId: "cheonan",
    label: "천안역",
    adminLabel: "충청남도 천안시 동남구 대흥로 239",
    latitude: 36.808837,
    longitude: 127.1471716,
    aliases: ["천안 역", "경부선 천안역", "천안역 동부광장"]
  }
];

function normalizePlaceQuery(value: string) {
  return value.replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
}

export function getDemoPlace(id: string) {
  return demoPlaces.find((place) => place.id === id);
}

export function getDemoRegionProfile(regionId: DemoRegionId) {
  return demoRegionProfiles[regionId];
}

export function findDemoPlace(query: string): DemoPlace | undefined {
  const normalized = normalizePlaceQuery(query);
  if (!normalized) return undefined;

  const exactMatch = demoPlaces.find((place) =>
    [place.label, ...place.aliases].some(
      (alias) => normalizePlaceQuery(alias) === normalized
    )
  );
  if (exactMatch || normalized.length < 2) return exactMatch;

  const partialMatches = demoPlaces.filter((place) =>
    [place.label, ...place.aliases].some((alias) => {
      const normalizedAlias = normalizePlaceQuery(alias);
      return normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized);
    })
  );

  return partialMatches.length === 1 ? partialMatches[0] : undefined;
}

export function findDemoArea(latitude: number, longitude: number) {
  const profile = Object.values(demoRegionProfiles).find(
    ({ geofence }) =>
      Math.abs(latitude - geofence.latitude) <= geofence.latitudeTolerance &&
      Math.abs(longitude - geofence.longitude) <= geofence.longitudeTolerance
  );

  return profile ? getDemoPlace(profile.geofence.proxyPlaceId) : undefined;
}
