export type IntroRegionId = "hansung" | "gongju" | "jeonju" | "gyeongju" | "jeju";

export type IntroPoint = {
  x: number;
  y: number;
};

export type IntroStopover = IntroPoint & {
  label: string;
};

export type IntroRegion = {
  id: IntroRegionId;
  oldName: string;
  currentName: string;
  subtitle: string;
  description: string;
  marker: IntroPoint;
  routePath: string;
  stopoverPoints: IntroStopover[];
  stampLabel: string;
};

export const MAP_VIEWBOX = {
  width: 1487,
  height: 1058
} as const;

export const ORIGIN_POINT: IntroPoint = {
  x: 118,
  y: 752
};

export const introRegions: IntroRegion[] = [
  {
    id: "hansung",
    oldName: "한성부",
    currentName: "서울",
    subtitle: "조선의 도읍과 행정 중심",
    description:
      "궁궐과 육조 거리, 한강 수로가 만나는 조선의 중심 권역입니다. 고지도 판독에서는 도성의 성곽과 주요 관청 표기를 기준으로 현재 서울과 연결합니다.",
    marker: { x: 1120, y: 532 },
    routePath:
      "M 96 756 C 128 735, 172 732, 209 708 C 245 686, 286 682, 321 662 C 360 639, 400 636, 445 624 C 500 607, 538 620, 575 603 C 616 584, 668 594, 708 565 C 742 540, 775 555, 802 535 C 875 511, 924 540, 981 559 C 1032 576, 1073 562, 1120 532",
    stopoverPoints: [
      { x: 381, y: 672, label: "여산" },
      { x: 574, y: 638, label: "전주" }
    ],
    stampLabel: "漢"
  },
  {
    id: "gongju",
    oldName: "공주목",
    currentName: "충남 공주",
    subtitle: "충청 감영의 중심지",
    description:
      "금강 물길과 내륙 교통이 만나는 충청도의 핵심 거점입니다. 현재 지점과 가까운 기준점으로, 여정의 출발 맥락을 보여줍니다.",
    marker: { x: 148, y: 728 },
    routePath: "M 96 756 C 112 746, 129 738, 148 728",
    stopoverPoints: [{ x: 122, y: 744, label: "금강" }],
    stampLabel: "公"
  },
  {
    id: "jeonju",
    oldName: "전주부",
    currentName: "전북 전주",
    subtitle: "호남 행정과 기록 문화의 거점",
    description:
      "완산 일대의 행정 중심지로, 조선 왕실의 본향이라는 상징성과 호남 내륙 교통의 결절점을 함께 가진 지역입니다.",
    marker: { x: 574, y: 638 },
    routePath:
      "M 96 756 C 128 735, 172 732, 209 708 C 245 686, 286 682, 321 662 C 360 639, 400 636, 445 624 C 500 607, 538 620, 574 638",
    stopoverPoints: [
      { x: 381, y: 672, label: "여산" },
      { x: 505, y: 613, label: "삼례" }
    ],
    stampLabel: "全"
  },
  {
    id: "gyeongju",
    oldName: "경주부",
    currentName: "경북 경주",
    subtitle: "신라 고도와 동남부 길목",
    description:
      "동남부 산악과 해안 길이 만나는 고도입니다. 대동여지도에서는 산줄기와 주요 역로를 함께 읽어 현재 경주 권역과 대조합니다.",
    marker: { x: 1278, y: 748 },
    routePath:
      "M 96 756 C 155 720, 225 706, 304 664 C 402 613, 486 592, 574 638 C 677 692, 792 605, 903 638 C 1020 673, 1137 714, 1278 748",
    stopoverPoints: [
      { x: 574, y: 638, label: "전주" },
      { x: 904, y: 638, label: "문경" }
    ],
    stampLabel: "慶"
  },
  {
    id: "jeju",
    oldName: "제주목",
    currentName: "제주",
    subtitle: "바다 건너 이어지는 남쪽 경계",
    description:
      "육지 길과 해로가 함께 이어지는 남쪽 섬 권역입니다. 지도 판독에서는 해협 표기와 제주목 위치를 함께 확인합니다.",
    marker: { x: 520, y: 895 },
    routePath:
      "M 96 756 C 158 779, 228 786, 296 806 C 377 831, 447 859, 520 895",
    stopoverPoints: [
      { x: 296, y: 806, label: "나주" },
      { x: 447, y: 859, label: "해남" }
    ],
    stampLabel: "濟"
  }
];
