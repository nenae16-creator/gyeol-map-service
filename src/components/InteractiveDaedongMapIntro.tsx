import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import type { MapRegionReference } from "../domain/gyeolEvidence";
import styles from "./interactive-map/InteractiveDaedongMapIntro.module.css";

type IntroPhase =
  | "idle"
  | "positioning"
  | "unfolding"
  | "revealing"
  | "walking"
  | "arrived";

type Point = {
  x: number;
  y: number;
};

type InteractiveDaedongMapIntroProps = {
  autoStart?: boolean;
  selectedPlaceId?: string;
  mapRegions?: MapRegionReference[];
};

type AssetKey =
  | "clean"
  | "idle"
  | "static"
  | "centered"
  | "detail"
  | "folded"
  | "mask"
  | "walker"
  | `panel-${number}`;

const CLEAN_PLATE_URL = "/assets/gyeol-clean-desk-plate.png";
const IDLE_PLATE_URL = "/assets/gyeol-opening-desk-plate-v2.png";
const STATIC_PLATE_URL = "/assets/gyeol-static-desk-plate.png";
const STATIC_MASK_URL = "/assets/static-paper-feather-mask.png";
const CENTERED_MAP_URL = "/assets/daedongyeojido-idle-toned-v2.png";
const FOLDED_MAP_URL = "/assets/gyeol-folded-route-base-v5.png";
const DETAIL_MAP_URL = "/assets/official/nmk-shinsu19997-doseongdo-original.jpg";
const WALKER_URL = "/assets/kim-jeongho-walker.png";
const FOLD_PANEL_URLS = Array.from(
  { length: 8 },
  (_, index) => `/assets/gyeol-fold-panel-${index + 1}.png`
);

const FOLDED_IMAGE = {
  width: 1607,
  height: 979,
  bounds: { left: 228, top: 153, width: 1187, height: 641 }
} as const;
const ROUTE_FRAME = { width: 872, height: 518 } as const;
const SCENE_FRAME = { width: 1487, height: 1058 } as const;
const FOLDED_FRAME = {
  left: 0,
  top: 0.3422,
  width: 0.5865,
  height: 0.4896
} as const;
const DETAIL_FRAME = {
  left: 0.44,
  top: 0.14,
  width: 0.545,
  height: 0.5791113538
} as const;
const DETAIL_CROP = {
  x: 351 / 3000,
  y: 78 / 1825,
  width: 2238 / 3000,
  height: 1692 / 1825
} as const;
const FOLD_CREASES = [228, 430, 605, 713, 847, 995, 1142, 1268, 1415] as const;
const REQUIRED_ASSET_COUNT = 16;

type DetailLocation = {
  id: string;
  modernPlaceId: string;
  label: string;
  point: Point;
  description: string;
};

type KoreanLandmark = {
  id: string;
  label: string;
  point: Point;
  side: "left" | "right";
  offsetY: string;
  priority: "primary" | "secondary";
  mobile: boolean;
  modernPlaceId?: string;
};

const DEFAULT_DETAIL_LOCATIONS: DetailLocation[] = [
  {
    id: "doseongdo-gyeongbokgung-estimate",
    modernPlaceId: "gyeongbokgung",
    label: "경복궁 · 도상 식별",
    point: { x: 0.380667, y: 0.318904 },
    description: "공식 도성도에서 판독한 경복궁 도상 기준점"
  },
  {
    id: "doseongdo-gwanghwamun-estimate",
    modernPlaceId: "gwanghwamun",
    label: "광화문 · 도상 식별",
    point: { x: 0.382333, y: 0.37589 },
    description: "공식 도성도에서 판독한 광화문 도상 기준점"
  },
  {
    id: "doseongdo-seoul-city-hall-estimate",
    modernPlaceId: "seoul-city-hall",
    label: "서울시청 · 현대 위치 추정",
    point: { x: 0.388667, y: 0.649315 },
    description: "조선시대 군기시 터 인근에 투영한 낮은 신뢰도의 현대 위치 추정점"
  }
];

const KOREAN_LANDMARKS: KoreanLandmark[] = [
  {
    id: "gyeongbokgung",
    label: "경복궁",
    point: { x: 0.380667, y: 0.318904 },
    side: "right",
    offsetY: "-13px",
    priority: "primary",
    mobile: true,
    modernPlaceId: "gyeongbokgung"
  },
  {
    id: "gwanghwamun",
    label: "광화문",
    point: { x: 0.382333, y: 0.37589 },
    side: "left",
    offsetY: "11px",
    priority: "primary",
    mobile: true,
    modernPlaceId: "gwanghwamun"
  },
  {
    id: "sajikdan",
    label: "사직단",
    point: { x: 0.273667, y: 0.411507 },
    side: "left",
    offsetY: "-11px",
    priority: "primary",
    mobile: false
  },
  {
    id: "gyeonghuigung",
    label: "경희궁",
    point: { x: 0.288667, y: 0.487123 },
    side: "left",
    offsetY: "9px",
    priority: "primary",
    mobile: false
  },
  {
    id: "changdeokgung",
    label: "창덕궁",
    point: { x: 0.543333, y: 0.29863 },
    side: "right",
    offsetY: "-12px",
    priority: "primary",
    mobile: true
  },
  {
    id: "changgyeonggung",
    label: "창경궁",
    point: { x: 0.620667, y: 0.330959 },
    side: "right",
    offsetY: "10px",
    priority: "primary",
    mobile: false
  },
  {
    id: "jongmyo",
    label: "종묘",
    point: { x: 0.553333, y: 0.410411 },
    side: "right",
    offsetY: "8px",
    priority: "primary",
    mobile: true
  },
  {
    id: "munmyo",
    label: "문묘",
    point: { x: 0.623333, y: 0.253699 },
    side: "right",
    offsetY: "-11px",
    priority: "primary",
    mobile: false
  },
  {
    id: "donuimun",
    label: "돈의문",
    point: { x: 0.232333, y: 0.491507 },
    side: "left",
    offsetY: "-5px",
    priority: "secondary",
    mobile: false
  },
  {
    id: "sungnyemun",
    label: "숭례문",
    point: { x: 0.339667, y: 0.787397 },
    side: "right",
    offsetY: "8px",
    priority: "secondary",
    mobile: false
  },
  {
    id: "heunginjimun",
    label: "흥인지문",
    point: { x: 0.731333, y: 0.518356 },
    side: "left",
    offsetY: "-5px",
    priority: "secondary",
    mobile: false
  }
];

const DETAIL_IMAGE_FILTER_HIDDEN =
  "blur(12px) sepia(0.42) saturate(0.62) contrast(0.76) brightness(0.98)";
const DETAIL_IMAGE_FILTER_VISIBLE =
  "blur(0px) sepia(0.4) saturate(0.72) contrast(0.92) brightness(0.9)";

// Normalized against the visible paper bounds in the transparent folded-map asset.
const routeBasePoints: Point[] = [
  { x: 0.18, y: 0.7853 },
  { x: 0.1961, y: 0.7875 },
  { x: 0.2121, y: 0.7813 },
  { x: 0.2282, y: 0.7613 },
  { x: 0.2442, y: 0.738 },
  { x: 0.2603, y: 0.7213 },
  { x: 0.2763, y: 0.7036 },
  { x: 0.2924, y: 0.6853 },
  { x: 0.3084, y: 0.6729 },
  { x: 0.3245, y: 0.6662 },
  { x: 0.3405, y: 0.6358 },
  { x: 0.3566, y: 0.5911 },
  { x: 0.3727, y: 0.5618 },
  { x: 0.3887, y: 0.5486 },
  { x: 0.4048, y: 0.5457 },
  { x: 0.4208, y: 0.5419 },
  { x: 0.4369, y: 0.5311 },
  { x: 0.4529, y: 0.5281 },
  { x: 0.469, y: 0.5303 },
  { x: 0.485, y: 0.5369 },
  { x: 0.5011, y: 0.5436 },
  { x: 0.5171, y: 0.5462 },
  { x: 0.5332, y: 0.5527 },
  { x: 0.5492, y: 0.5498 },
  { x: 0.5653, y: 0.5298 },
  { x: 0.5813, y: 0.5193 },
  { x: 0.5974, y: 0.5084 },
  { x: 0.6134, y: 0.4935 },
  { x: 0.6295, y: 0.4776 },
  { x: 0.6455, y: 0.4596 },
  { x: 0.6616, y: 0.4431 },
  { x: 0.6777, y: 0.436 },
  { x: 0.6937, y: 0.4326 },
  { x: 0.7098, y: 0.4321 },
  { x: 0.7258, y: 0.4403 },
  { x: 0.7419, y: 0.456 },
  { x: 0.7579, y: 0.4687 },
  { x: 0.774, y: 0.4735 },
  { x: 0.79, y: 0.4739 },
  { x: 0.8061, y: 0.4737 },
  { x: 0.8221, y: 0.4749 },
  { x: 0.8382, y: 0.4762 },
  { x: 0.8542, y: 0.4767 },
  { x: 0.8703, y: 0.4761 },
  { x: 0.8863, y: 0.4736 },
  { x: 0.9024, y: 0.471 },
  { x: 0.9184, y: 0.4698 },
  { x: 0.9345, y: 0.4676 },
  { x: 0.9506, y: 0.4652 },
  { x: 0.9666, y: 0.4635 },
  { x: 0.9827, y: 0.4618 },
  { x: 0.9987, y: 0.4567 },
  { x: 1.0148, y: 0.4505 },
  { x: 1.0308, y: 0.4379 },
  { x: 1.0469, y: 0.4107 },
  { x: 1.0629, y: 0.3937 },
  { x: 1.079, y: 0.3886 },
  { x: 1.095, y: 0.3859 },
  { x: 1.1111, y: 0.389 },
  { x: 1.1271, y: 0.3988 },
  { x: 1.1432, y: 0.4062 },
  { x: 1.1592, y: 0.4065 },
  { x: 1.165, y: 0.4041 }
];

function buildRouteDistances(routePoints: Point[]) {
  return routePoints.reduce<number[]>((distances, point, index) => {
  if (index === 0) return [0];
  const previous = routePoints[index - 1];
  distances.push(
    distances[index - 1] +
      Math.hypot(
        (point.x - previous.x) * ROUTE_FRAME.width,
        (point.y - previous.y) * ROUTE_FRAME.height
      )
  );
  return distances;
  }, []);
}

function cropPoint(point: Point) {
  return {
    x: (point.x - DETAIL_CROP.x) / DETAIL_CROP.width,
    y: (point.y - DETAIL_CROP.y) / DETAIL_CROP.height
  };
}

function destinationRoutePoint(point: Point) {
  const cropped = cropPoint(point);
  const sceneX = (DETAIL_FRAME.left + cropped.x * DETAIL_FRAME.width) * SCENE_FRAME.width;
  const sceneY = (DETAIL_FRAME.top + cropped.y * DETAIL_FRAME.height) * SCENE_FRAME.height;
  const foldedTop = FOLDED_FRAME.top * SCENE_FRAME.height;

  return {
    x: sceneX / ROUTE_FRAME.width,
    y: (sceneY - foldedTop) / ROUTE_FRAME.height
  };
}

function buildJourneyRoute(destination: Point) {
  const approach = routeBasePoints[routeBasePoints.length - 1];
  const midpoint = {
    x: approach.x + (destination.x - approach.x) * 0.52,
    y: approach.y + (destination.y - approach.y) * 0.52
  };

  return [...routeBasePoints, midpoint, destination];
}

function routePath(routePoints: Point[]) {
  const foldedTop = FOLDED_FRAME.top * SCENE_FRAME.height;
  return routePoints
    .map((point, index) => {
      const x = point.x * ROUTE_FRAME.width;
      const y = foldedTop + point.y * ROUTE_FRAME.height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

const phaseText: Record<IntroPhase, string> = {
  idle: "가운데 대동여지도에서 한성부를 선택하세요.",
  positioning: "대동여지도를 왼쪽 여정 위치로 옮기고 있습니다.",
  unfolding: "접이식 지도가 펼쳐지며 먹길이 번지고 있습니다.",
  revealing: "먹길 끝에서 국립중앙박물관 소장 대동여지도의 도성도를 확대하고 있습니다.",
  walking: "김정호 캐릭터가 서비스가 구성한 먹길을 따라 한성부 권역 후보로 이동하고 있습니다.",
  arrived: "김정호 캐릭터가 도성도의 선택 위치 후보에 도착했습니다."
};

function getRoutePoint(
  progress: number,
  routePoints: Point[],
  routeDistances: number[]
): Point {
  const routeLength = routeDistances[routeDistances.length - 1] ?? 0;
  const targetDistance = Math.min(Math.max(progress, 0), 1) * routeLength;
  let low = 0;
  let high = routeDistances.length - 1;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (routeDistances[middle] < targetDistance) low = middle + 1;
    else high = middle;
  }

  const nextIndex = Math.max(1, low);
  const previousIndex = nextIndex - 1;
  const span = routeDistances[nextIndex] - routeDistances[previousIndex] || 1;
  const localProgress = (targetDistance - routeDistances[previousIndex]) / span;

  return {
    x:
      routePoints[previousIndex].x +
      (routePoints[nextIndex].x - routePoints[previousIndex].x) * localProgress,
    y:
      routePoints[previousIndex].y +
      (routePoints[nextIndex].y - routePoints[previousIndex].y) * localProgress
  };
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function InteractiveDaedongMapIntro({
  autoStart = false,
  selectedPlaceId = "seoul-city-hall",
  mapRegions
}: InteractiveDaedongMapIntroProps) {
  const [phase, setPhase] = useState<IntroPhase>("idle");
  const [assetsReady, setAssetsReady] = useState(false);
  const [assetError, setAssetError] = useState(false);

  const rootRef = useRef<HTMLElement | null>(null);
  const idlePlateRef = useRef<HTMLImageElement | null>(null);
  const staticPlateRef = useRef<HTMLImageElement | null>(null);
  const centeredMapRef = useRef<HTMLDivElement | null>(null);
  const centeredMapNormalRef = useRef<HTMLImageElement | null>(null);
  const centeredMapInkRef = useRef<HTMLImageElement | null>(null);
  const hotspotRef = useRef<HTMLButtonElement | null>(null);
  const detailMapRef = useRef<HTMLDivElement | null>(null);
  const detailImageRef = useRef<HTMLImageElement | null>(null);
  const foldedMapRef = useRef<HTMLDivElement | null>(null);
  const foldedBaseRef = useRef<HTMLImageElement | null>(null);
  const routeInkRef = useRef<SVGSVGElement | null>(null);
  const walkerRef = useRef<HTMLDivElement | null>(null);
  const arrivalRef = useRef<HTMLDivElement | null>(null);
  const skipRef = useRef<HTMLButtonElement | null>(null);
  const replayRef = useRef<HTMLButtonElement | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const walkProgressRef = useRef({ value: 0 });
  const routeFrameSizeRef = useRef<{ width: number; height: number }>(ROUTE_FRAME);
  const loadedAssetsRef = useRef(new Set<AssetKey>());
  const focusTimerRef = useRef<number | null>(null);
  const autoStartedRef = useRef(false);

  const detailLocations = useMemo<DetailLocation[]>(() => {
    const registeredLocations = mapRegions
      ?.filter(
        (region) =>
          region.mapId === "nmk-shinsu19997-img07-doseongdo-original" &&
          Boolean(region.modernPlaceId)
      )
      .map((region) => ({
        id: region.id,
        modernPlaceId: region.modernPlaceId ?? "seoul-city-hall",
        label: region.label,
        point: { x: region.point.x, y: region.point.y },
        description: region.reviewNote
      }));

    return registeredLocations?.length ? registeredLocations : DEFAULT_DETAIL_LOCATIONS;
  }, [mapRegions]);
  const normalizedPlaceId =
    selectedPlaceId === "browser-location" ? "seoul-city-hall" : selectedPlaceId;
  const activeLocation =
    detailLocations.find((location) => location.modernPlaceId === normalizedPlaceId) ??
    detailLocations.find((location) => location.modernPlaceId === "seoul-city-hall") ??
    detailLocations[0];
  const detailVisible =
    phase === "revealing" || phase === "walking" || phase === "arrived";
  const activeCropPoint = cropPoint(activeLocation.point);
  const activeDestination = destinationRoutePoint(activeLocation.point);
  const journeyRoutePoints = useMemo(
    () => buildJourneyRoute(activeDestination),
    [activeDestination.x, activeDestination.y]
  );
  const journeyRouteDistances = useMemo(
    () => buildRouteDistances(journeyRoutePoints),
    [journeyRoutePoints]
  );
  const journeyRouteLength =
    journeyRouteDistances[journeyRouteDistances.length - 1] ?? 1;
  const journeyRoutePath = useMemo(
    () => routePath(journeyRoutePoints),
    [journeyRoutePoints]
  );
  const arrivalStyle = {
    "--arrival-x": `${(DETAIL_FRAME.left + activeCropPoint.x * DETAIL_FRAME.width + 0.024) * 100}%`,
    "--arrival-y": `${(DETAIL_FRAME.top + activeCropPoint.y * DETAIL_FRAME.height - 0.032) * 100}%`
  } as CSSProperties;

  const markAssetReady = (asset: AssetKey) => {
    if (loadedAssetsRef.current.has(asset)) return;

    loadedAssetsRef.current.add(asset);
    if (loadedAssetsRef.current.size === REQUIRED_ASSET_COUNT) setAssetsReady(true);
  };

  const markAssetError = () => setAssetError(true);

  const focusLater = (getTarget: () => HTMLElement | null) => {
    if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current);

    focusTimerRef.current = window.setTimeout(() => {
      getTarget()?.focus({ preventScroll: true });
      focusTimerRef.current = null;
    }, 0);
  };

  const measureRouteFrame = () => {
    const frame = foldedMapRef.current;
    if (!frame) return;

    routeFrameSizeRef.current = {
      width: frame.clientWidth || ROUTE_FRAME.width,
      height: frame.clientHeight || ROUTE_FRAME.height
    };
  };

  const placeWalker = (progress: number, animateStep = false) => {
    const walker = walkerRef.current;
    if (!walker) return;

    const point = getRoutePoint(progress, journeyRoutePoints, journeyRouteDistances);
    const step = animateStep ? Math.sin(progress * Math.PI * 42) : 0;
    const frame = routeFrameSizeRef.current;

    gsap.set(walker, {
      x: point.x * frame.width,
      y: point.y * frame.height + step * 3.2,
      xPercent: -50,
      yPercent: -100,
      rotation: step * 1.4
    });
  };

  const resetExperience = (restoreFocus = false) => {
    const root = rootRef.current;
    if (!root) return;

    const q = gsap.utils.selector(root);
    const panels = q(`.${styles.foldPanel}`);
    const routePaths = q(`.${styles.routeInkPath}`);

    timelineRef.current?.kill();
    walkProgressRef.current.value = 0;
    setPhase("idle");

    gsap.set(idlePlateRef.current, {
      autoAlpha: 1,
      filter: "blur(0px) brightness(1)"
    });
    gsap.set(staticPlateRef.current, { autoAlpha: 0 });
    gsap.set(centeredMapRef.current, {
      autoAlpha: 1,
      xPercent: 0,
      yPercent: 0,
      scale: 1,
      rotateY: 0,
      rotateZ: 0
    });
    gsap.set(centeredMapNormalRef.current, {
      autoAlpha: 1,
      filter: "sepia(0.12) contrast(0.99) brightness(0.96) blur(0px)"
    });
    gsap.set(centeredMapInkRef.current, {
      autoAlpha: 0,
      filter: "sepia(0.85) saturate(0.65) contrast(1.2) brightness(0.66) blur(0.4px)"
    });
    gsap.set(hotspotRef.current, { autoAlpha: 1, scale: 1 });
    gsap.set(detailMapRef.current, {
      autoAlpha: 0,
      xPercent: 0,
      yPercent: 0,
      scale: 0.14,
      rotateZ: 1.5,
      rotateY: -18
    });
    gsap.set(detailImageRef.current, {
      filter: DETAIL_IMAGE_FILTER_HIDDEN
    });
    gsap.set(foldedMapRef.current, { autoAlpha: 0 });
    gsap.set(foldedBaseRef.current, {
      autoAlpha: 0,
      filter: "blur(1.5px) contrast(0.82) brightness(1.06) saturate(0.72)"
    });
    gsap.set(routeInkRef.current, {
      autoAlpha: 0,
      filter: "blur(2.6px)"
    });
    gsap.set(routePaths, { strokeDashoffset: journeyRouteLength });
    gsap.set(panels, {
      autoAlpha: 0,
      xPercent: (index: number) =>
        -(
          (FOLD_CREASES[index] - FOLDED_IMAGE.bounds.left) /
          (FOLD_CREASES[index + 1] - FOLD_CREASES[index])
        ) * 100,
      y: (index: number) => (index % 2 === 0 ? 16 : -14),
      z: -28,
      scaleX: 0.015,
      rotateY: (index: number) => (index % 2 === 0 ? 92 : -92),
      rotateZ: (index: number) => (index % 2 === 0 ? -4 : 4),
      transformOrigin: (index: number) => (index % 2 === 0 ? "0% 50%" : "100% 50%")
    });
    measureRouteFrame();
    placeWalker(0);
    gsap.set(walkerRef.current, { autoAlpha: 0, scale: 1 });
    gsap.set(arrivalRef.current, { autoAlpha: 0, scale: 1.6, rotate: -8 });
    gsap.set(replayRef.current, { autoAlpha: 0, y: 8 });

    if (restoreFocus) {
      focusLater(() => hotspotRef.current);
    }
  };

  const finishJourney = () => {
    const root = rootRef.current;
    if (!root) return;

    const q = gsap.utils.selector(root);
    const routePaths = q(`.${styles.routeInkPath}`);
    timelineRef.current?.kill();
    walkProgressRef.current.value = 1;
    setPhase("arrived");

    gsap.set(idlePlateRef.current, { autoAlpha: 0 });
    gsap.set(centeredMapRef.current, { autoAlpha: 0 });
    gsap.set(staticPlateRef.current, { autoAlpha: 1 });
    gsap.set(hotspotRef.current, { autoAlpha: 0 });
    gsap.set(detailMapRef.current, {
      autoAlpha: 1,
      xPercent: 0,
      yPercent: 0,
      scale: 1,
      rotate: 0,
      rotateY: 0
    });
    gsap.set(detailImageRef.current, { filter: DETAIL_IMAGE_FILTER_VISIBLE });
    gsap.set(foldedMapRef.current, { autoAlpha: 1 });
    gsap.set(foldedBaseRef.current, {
      autoAlpha: 1,
      filter: "blur(0px) contrast(1) brightness(1) saturate(1)"
    });
    gsap.set(q(`.${styles.foldPanel}`), { autoAlpha: 0 });
    gsap.set(routeInkRef.current, {
      autoAlpha: 1,
      filter: "blur(0px)"
    });
    gsap.set(routePaths, { strokeDashoffset: 0 });
    measureRouteFrame();
    placeWalker(1);
    gsap.set(walkerRef.current, { autoAlpha: 1, scale: 1 });
    gsap.set(arrivalRef.current, { autoAlpha: 1, scale: 1, rotate: 0 });
    gsap.set(replayRef.current, { autoAlpha: 1, y: 0 });
    focusLater(() => replayRef.current);
  };

  const runJourney = () => {
    const root = rootRef.current;
    if (!root || !assetsReady || phase !== "idle") return;

    if (prefersReducedMotion()) {
      finishJourney();
      return;
    }

    const q = gsap.utils.selector(root);
    const panels = q(`.${styles.foldPanel}`);
    const routePaths = q(`.${styles.routeInkPath}`);

    timelineRef.current?.kill();
    walkProgressRef.current.value = 0;

    timelineRef.current = gsap
      .timeline({ defaults: { ease: "power2.inOut" } })
      .call(
        () => {
          setPhase("positioning");
          focusLater(() => skipRef.current);
        },
        undefined,
        0
      )
      .to(hotspotRef.current, { autoAlpha: 0, scale: 0.62, duration: 0.2 }, 0)
      .to(
        centeredMapRef.current,
        {
          xPercent: -75.5,
          yPercent: -7.3,
          scale: 0.9,
          rotateY: -10,
          rotateZ: 4.5,
          duration: 1.55,
          ease: "power3.inOut"
        },
        0
      )
      .to(
        idlePlateRef.current,
        {
          autoAlpha: 0,
          filter: "blur(1px) brightness(0.92)",
          duration: 1,
          ease: "sine.inOut"
        },
        0.45
      )
      .to(
        staticPlateRef.current,
        { autoAlpha: 1, duration: 0.95, ease: "sine.inOut" },
        0.58
      )
      .to(
        centeredMapNormalRef.current,
        {
          autoAlpha: 0,
          filter:
            "sepia(0.68) saturate(0.68) contrast(0.9) brightness(0.78) blur(1.4px)",
          duration: 0.95,
          ease: "sine.inOut"
        },
        0.55
      )
      .to(centeredMapInkRef.current, { autoAlpha: 0.72, duration: 0.45 }, 0.42)
      .to(
        centeredMapInkRef.current,
        {
          autoAlpha: 0,
          filter: "sepia(0.9) contrast(1.45) brightness(0.62) blur(2px)",
          duration: 0.75,
          ease: "sine.inOut"
        },
        0.8
      )
      .call(() => setPhase("unfolding"), undefined, 1.58)
      .set(foldedMapRef.current, { autoAlpha: 1 }, 1.6)
      .to(
        panels,
        {
          autoAlpha: 1,
          xPercent: 0,
          y: (index: number) => (index % 2 === 0 ? 2 : -2),
          z: 0,
          scaleX: 1,
          rotateY: (index: number) => (index % 2 === 0 ? 1.5 : -1.5),
          rotateZ: (index: number) => (index % 2 === 0 ? -0.4 : 0.4),
          duration: 0.82,
          stagger: { each: 0.18, from: "start" },
          ease: "power4.out"
        },
        1.64
      )
      .to(
        panels,
        { y: 0, rotateY: 0, rotateZ: 0, duration: 0.22, ease: "sine.out" },
        3.72
      )
      .to(
        foldedBaseRef.current,
        {
          autoAlpha: 1,
          filter: "blur(0px) contrast(1) brightness(1) saturate(1)",
          duration: 0.38,
          ease: "sine.out"
        },
        3.9
      )
      .set(routeInkRef.current, { autoAlpha: 0.96 }, 3.9)
      .to(
        routePaths,
        {
          strokeDashoffset: 0,
          duration: 2.35,
          ease: "power1.inOut"
        },
        3.9
      )
      .to(routeInkRef.current, { filter: "blur(0px)", duration: 1.8 }, 3.9)
      .to(panels, { autoAlpha: 0, duration: 0.28, ease: "sine.inOut" }, 4.02)
      .call(() => setPhase("revealing"), undefined, 4.48)
      .to(
        detailMapRef.current,
        {
          autoAlpha: 1,
          xPercent: 0,
          yPercent: 0,
          scale: 1,
          rotateZ: 0,
          rotateY: 0,
          duration: 1.35,
          ease: "expo.out"
        },
        4.5
      )
      .to(
        detailImageRef.current,
        {
          filter: DETAIL_IMAGE_FILTER_VISIBLE,
          duration: 1.05,
          ease: "power2.out"
        },
        4.5
      )
      .call(
        () => {
          measureRouteFrame();
          setPhase("walking");
        },
        undefined,
        6.38
      )
      .set(walkerRef.current, { autoAlpha: 1 }, 6.4)
      .to(
        walkProgressRef.current,
        {
          value: 1,
          duration: 12.5,
          ease: "none",
          onUpdate: () => placeWalker(walkProgressRef.current.value, true)
        },
        6.42
      )
      .call(() => setPhase("arrived"), undefined, 18.92)
      .to(
        arrivalRef.current,
        { autoAlpha: 1, scale: 1, rotate: 0, duration: 0.38, ease: "back.out(1.9)" },
        18.94
      )
      .to(replayRef.current, { autoAlpha: 1, y: 0, duration: 0.28 }, 19)
      .call(() => focusLater(() => replayRef.current), undefined, 19.32);
  };

  useEffect(() => {
    resetExperience(false);
    const handleResize = () => {
      measureRouteFrame();
      placeWalker(walkProgressRef.current.value);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      timelineRef.current?.kill();
      window.removeEventListener("resize", handleResize);
      if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!autoStart || !assetsReady || phase !== "idle" || autoStartedRef.current) return;

    autoStartedRef.current = true;
    const frame = window.requestAnimationFrame(runJourney);
    return () => window.cancelAnimationFrame(frame);
  }, [assetsReady, autoStart, phase]);

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotionPreference = (event: MediaQueryListEvent) => {
      if (event.matches && phase !== "idle" && phase !== "arrived") finishJourney();
    };

    motionPreference.addEventListener("change", handleMotionPreference);
    return () => motionPreference.removeEventListener("change", handleMotionPreference);
  }, [phase]);

  return (
    <section
      ref={rootRef}
      className={styles.intro}
      data-phase={phase}
      data-ready={assetsReady}
      aria-busy={!assetsReady && !assetError}
      aria-label="대동여지도에서 도성도의 위치 후보로 이어지는 김정호 캐릭터의 시각화 여정"
    >
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {assetError
          ? "지도 자산을 불러오지 못했습니다. 페이지를 새로고침해 주세요."
          : assetsReady
            ? phaseText[phase]
            : "지도를 준비하고 있습니다."}
      </p>

      <div className={styles.scene}>
        <p className={styles.assetError} role="alert" hidden={!assetError}>
          지도를 불러오지 못했습니다. 페이지를 새로고침해 주세요.
        </p>

        <img
          className={styles.cleanPlate}
          src={CLEAN_PLATE_URL}
          alt=""
          aria-hidden="true"
          onLoad={() => markAssetReady("clean")}
          onError={markAssetError}
        />

        <img
          ref={idlePlateRef}
          className={styles.idlePlate}
          src={IDLE_PLATE_URL}
          alt=""
          aria-hidden="true"
          onLoad={() => markAssetReady("idle")}
          onError={markAssetError}
        />

        <img
          ref={staticPlateRef}
          className={styles.staticPlate}
          src={STATIC_PLATE_URL}
          alt=""
          aria-hidden="true"
          onLoad={() => markAssetReady("static")}
          onError={markAssetError}
        />

        <img
          className={styles.maskPreload}
          src={STATIC_MASK_URL}
          alt=""
          aria-hidden="true"
          onLoad={() => markAssetReady("mask")}
          onError={markAssetError}
        />

        <div
          ref={centeredMapRef}
          className={styles.centeredMap}
          aria-hidden={phase !== "idle" && phase !== "positioning"}
        >
          <img
            ref={centeredMapNormalRef}
            className={styles.centeredMapNormal}
            src={CENTERED_MAP_URL}
            alt="화면 중앙에 놓인 대동여지도 전체 지도"
            onLoad={() => markAssetReady("centered")}
            onError={markAssetError}
          />
          <img
            ref={centeredMapInkRef}
            className={styles.centeredMapInk}
            src={CENTERED_MAP_URL}
            alt=""
            aria-hidden="true"
          />
        </div>

        <button
          ref={hotspotRef}
          type="button"
          className={styles.hansungHotspot}
          onClick={runJourney}
          disabled={!assetsReady || phase !== "idle"}
          aria-label="가운데 대동여지도에서 한성부를 선택해 여정을 시작하기"
        >
          <span>한성부</span>
        </button>

        <figure
          ref={detailMapRef}
          className={styles.detailMap}
          aria-labelledby="doseongdo-korean-title"
          aria-describedby="doseongdo-reading-note"
          aria-hidden={!detailVisible}
        >
          <div className={styles.detailViewport}>
            <div className={styles.detailSourceCanvas}>
              <img
                ref={detailImageRef}
                src={DETAIL_MAP_URL}
                alt="1861년 김정호가 제작한 대동여지도 신유본 중 도성도 원본"
                fetchPriority="high"
                onLoad={() => markAssetReady("detail")}
                onError={markAssetError}
              />

              <ul
                className={styles.koreanLandmarks}
                aria-label="도성도 주요 지명 한글 판독"
                aria-hidden={!detailVisible}
              >
                {KOREAN_LANDMARKS.map((landmark) => (
                  <li
                    key={landmark.id}
                    className={styles.koreanLandmark}
                    data-side={landmark.side}
                    data-priority={landmark.priority}
                    data-mobile={landmark.mobile}
                    data-selected={landmark.modernPlaceId === activeLocation.modernPlaceId}
                    style={
                      {
                        "--landmark-x": `${landmark.point.x * 100}%`,
                        "--landmark-y": `${landmark.point.y * 100}%`,
                        "--landmark-offset-y": landmark.offsetY
                      } as CSSProperties
                    }
                  >
                    <span className={styles.koreanLandmarkPin} aria-hidden="true" />
                    <span className={styles.koreanLandmarkLabel}>{landmark.label}</span>
                  </li>
                ))}
              </ul>

              <ul
                className={styles.detailLocations}
                aria-label="선택 장소와 도성도 대응 후보"
                aria-hidden={phase !== "arrived"}
              >
                {detailLocations.map((location) => (
                  <li
                    key={location.id}
                    className={styles.detailLocation}
                    data-active={location.id === activeLocation.id}
                    aria-current={location.id === activeLocation.id ? "location" : undefined}
                    style={
                      {
                        "--location-x": `${location.point.x * 100}%`,
                        "--location-y": `${location.point.y * 100}%`
                      } as CSSProperties
                    }
                  >
                    <span className={styles.detailLocationDot} aria-hidden="true" />
                    <strong>{location.label.split(" · ")[0]}</strong>
                    <small>{location.description}</small>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <header className={styles.detailMapTitle}>
            <strong id="doseongdo-korean-title">한성부</strong>
            <span>도성도 한글 판독</span>
          </header>
          {detailVisible && (
            <figcaption className={styles.detailCredit}>
              <span id="doseongdo-reading-note" className={styles.detailReadingNote}>
                한글 지명은 원본 위에 덧입힌 판독 안내입니다. 서울시청 일대는 현대 위치 추정입니다.
              </span>
              <span className={styles.detailSourceLine}>
                출처: {" "}
                <a
                  href="https://www.museum.go.kr/site/main/relic/search/view?relicId=4502"
                  target="_blank"
                  rel="noreferrer"
                >
                  국립중앙박물관 「대동여지도」 신수19997 (새 창)
                </a>
                {" · "}김정호 · 1861 · {" "}
                <a
                  href="https://www.kogl.or.kr/info/licenseType1.do"
                  target="_blank"
                  rel="noreferrer"
                >
                  공공누리 제1유형 (새 창)
                </a>
              </span>
            </figcaption>
          )}
        </figure>

        <div
          ref={foldedMapRef}
          className={styles.foldedMap}
          aria-hidden={phase === "idle" || phase === "positioning"}
        >
          <img
            ref={foldedBaseRef}
            className={styles.foldedBase}
            src={FOLDED_MAP_URL}
            alt="책상 위에 독립적으로 펼쳐진 접이식 경로 지도"
            onLoad={() => markAssetReady("folded")}
            onError={markAssetError}
          />

          <div className={styles.foldPanelLayer} aria-hidden="true">
            {FOLD_CREASES.slice(0, -1).map((crease, index) => {
              const nextCrease = FOLD_CREASES[index + 1];
              const panelWidth = nextCrease - crease;

              return (
                <div
                  key={crease}
                  className={styles.foldPanel}
                  style={{
                    left: `${
                      ((crease - FOLDED_IMAGE.bounds.left) / FOLDED_IMAGE.bounds.width) * 100
                    }%`,
                    width: `${(panelWidth / FOLDED_IMAGE.bounds.width) * 100}%`
                  }}
                >
                  <img
                    src={FOLD_PANEL_URLS[index]}
                    alt=""
                    onLoad={() => markAssetReady(`panel-${index}`)}
                    onError={markAssetError}
                  />
                </div>
              );
            })}
          </div>

        </div>

        <svg
          ref={routeInkRef}
          className={styles.routeInk}
          aria-hidden="true"
          viewBox={`0 0 ${SCENE_FRAME.width} ${SCENE_FRAME.height}`}
          preserveAspectRatio="none"
        >
          <path
            className={`${styles.routeInkPath} ${styles.routeInkFeather}`}
            d={journeyRoutePath}
            style={{
              strokeDasharray: journeyRouteLength,
              strokeDashoffset: journeyRouteLength
            }}
          />
          <path
            className={`${styles.routeInkPath} ${styles.routeInkCore}`}
            d={journeyRoutePath}
            style={{
              strokeDasharray: journeyRouteLength,
              strokeDashoffset: journeyRouteLength
            }}
          />
        </svg>

        <div ref={walkerRef} className={styles.walker} aria-hidden="true">
          <img
            src={WALKER_URL}
            alt=""
            onLoad={() => markAssetReady("walker")}
            onError={markAssetError}
          />
        </div>

        <div
          ref={arrivalRef}
          className={styles.arrivalStamp}
          style={arrivalStyle}
          aria-hidden="true"
        >
          도착
        </div>

        <button
          ref={skipRef}
          type="button"
          className={styles.skipButton}
          onClick={finishJourney}
          disabled={phase === "idle" || phase === "arrived"}
        >
          이동 건너뛰기
        </button>

        <button
          ref={replayRef}
          type="button"
          className={styles.replayButton}
          onClick={() => resetExperience(true)}
          disabled={phase !== "arrived"}
        >
          처음부터 다시 보기
        </button>
      </div>
    </section>
  );
}
