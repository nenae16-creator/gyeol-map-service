import { ExternalLink, Focus, MapPin, ScanSearch, ShieldCheck } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GyeolResultEnvelope, MapRegionReference } from "../domain/gyeolEvidence";
import { publicAssetUrl } from "../utils/publicAssetUrl";
import styles from "./regional-map/RegionalMapZoom.module.css";

type RegionalMapZoomProps = {
  result: GyeolResultEnvelope;
};

const SERVICE_PLATE_URL = publicAssetUrl("assets/gyeol-service-desk-plate.png");

function markerStyle(region: MapRegionReference) {
  return {
    "--point-x": `${region.point.x * 100}%`,
    "--point-y": `${region.point.y * 100}%`
  } as CSSProperties;
}

function cropStyle(region: MapRegionReference) {
  const bounds = region.bounds;
  if (!bounds) return undefined;

  const xPosition = bounds.x / (1 - bounds.width);
  const yPosition = bounds.y / (1 - bounds.height);
  const localPointX = (region.point.x - bounds.x) / bounds.width;
  const localPointY = (region.point.y - bounds.y) / bounds.height;

  return {
    backgroundImage: `url("${publicAssetUrl(region.assetPath)}")`,
    backgroundSize: `${100 / bounds.width}% ${100 / bounds.height}%`,
    backgroundPosition: `${xPosition * 100}% ${yPosition * 100}%`,
    aspectRatio:
      (region.assetSpace.width * bounds.width) /
      (region.assetSpace.height * bounds.height),
    "--crop-point-x": `${localPointX * 100}%`,
    "--crop-point-y": `${localPointY * 100}%`
  } as CSSProperties;
}

export function RegionalMapZoom({ result }: RegionalMapZoomProps) {
  const [ready, setReady] = useState(false);
  const [assetError, setAssetError] = useState(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const journey = result.experience.journey;

  const overviewRegion = useMemo(
    () =>
      result.mapRegions.find(
        (region) => region.id === result.experience.wholeMapRegionId
      ),
    [result]
  );
  const detailRegion = useMemo(
    () =>
      journey.kind === "regional-zoom"
        ? result.mapRegions.find((region) => region.id === journey.mapRegionId)
        : undefined,
    [journey, result.mapRegions]
  );
  const officialSource = result.sources.find(
    (source) => source.id === "nmk-collection-shinsu19997"
  );

  useEffect(() => {
    const assetPath = detailRegion?.assetPath;
    const focusFrame = window.requestAnimationFrame(() =>
      headingRef.current?.focus({ preventScroll: true })
    );
    if (!assetPath) return () => window.cancelAnimationFrame(focusFrame);

    const image = new Image();
    let cancelled = false;
    let revealStarted = false;
    let revealFrame = 0;

    const reveal = async () => {
      if (revealStarted) return;
      revealStarted = true;
      try {
        await image.decode();
      } catch {
        // 일부 브라우저는 로드가 끝난 이미지의 decode()를 거부할 수 있습니다.
      }
      if (cancelled) return;
      revealFrame = window.requestAnimationFrame(() => setReady(true));
    };

    setReady(false);
    setAssetError(false);
    image.onload = () => void reveal();
    image.onerror = () => {
      if (!cancelled) setAssetError(true);
    };
    image.src = publicAssetUrl(assetPath);
    if (image.complete && image.naturalWidth > 0) void reveal();

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
      window.cancelAnimationFrame(focusFrame);
      if (revealFrame) window.cancelAnimationFrame(revealFrame);
    };
  }, [detailRegion?.assetPath]);

  if (
    journey.kind !== "regional-zoom" ||
    !overviewRegion ||
    !detailRegion?.bounds ||
    assetError
  ) {
    return (
      <section className={styles.unavailable} role="status">
        <ShieldCheck aria-hidden="true" />
        <p>
          {assetError
            ? "공식 판면 이미지를 불러오지 못했습니다. 근거 결과로 돌아가 다시 시도해 주세요."
            : "이 권역의 공식 판면 확대 정보를 확인하지 못했습니다."}
        </p>
      </section>
    );
  }

  return (
    <section
      className={styles.root}
      data-ready={ready}
      data-asset-state={ready ? "ready" : "loading"}
      aria-busy={!ready}
      aria-label={journey.ariaLabel}
      data-testid="regional-map-zoom"
    >
      <img className={styles.backdrop} src={SERVICE_PLATE_URL} alt="" aria-hidden="true" />

      <header className={styles.header}>
        <div>
          <span className={styles.seal} aria-hidden="true">結</span>
          <span>
            <strong>GYEOL</strong>
            <small>대동여지도 판면 대조</small>
          </span>
        </div>
        <p>
          <ScanSearch aria-hidden="true" />
          전체 지도에서 공식 판면으로 이동합니다
        </p>
      </header>

      <div className={styles.stage}>
        {!ready && (
          <p className={styles.loadingNote} role="status">
            <ScanSearch aria-hidden="true" />
            공식 판면 원본을 준비하고 있습니다
          </p>
        )}
        <figure className={styles.overviewCard}>
          <div className={styles.overviewPaper}>
            <div className={styles.overviewImageLayer}>
              <img
                src={publicAssetUrl(overviewRegion.assetPath)}
                alt="대동여지도 전체 형상에서 천안군 권역 후보 위치를 표시한 지도"
              />
              <span className={styles.overviewMarker} style={markerStyle(overviewRegion)}>
                <span className={styles.markerPulse} aria-hidden="true" />
                <MapPin aria-hidden="true" />
                <b>천안군 권역 후보</b>
              </span>
            </div>
          </div>
          <figcaption>
            <span>1 · 전체 지도</span>
            로컬 전체지도 위 시각적 근사 위치
          </figcaption>
        </figure>

        <div className={styles.transfer} aria-hidden="true">
          <span>판면 대조</span>
          <svg viewBox="0 0 240 120" preserveAspectRatio="none">
            <path d="M 4 84 C 72 28, 142 104, 236 34" />
          </svg>
        </div>

        <article className={styles.detailCard}>
          <div className={styles.detailHeading}>
            <div>
              <p>2 · 1861년 신유본 공식 판면</p>
              <h1 ref={headingRef} tabIndex={-1}>천안 표기 판면 확대</h1>
              <span>천안 <i aria-hidden="true">天安</i></span>
            </div>
            <strong>권역 대응 추정</strong>
          </div>

          <figure className={styles.cropFigure}>
            <div
              className={styles.cropImage}
              style={cropStyle(detailRegion)}
              role="img"
              aria-label="국립중앙박물관 대동여지도 공식 판면에서 천안 표기를 확대한 모습"
            >
              <span className={styles.cropMarker}>
                <Focus aria-hidden="true" />
                <b>천안 표기</b>
              </span>
            </div>
            <figcaption>
              <span>시각 판독 위치</span>
              <strong>한글로 읽으면 ‘천안’입니다.</strong>
              <p>{detailRegion.reviewNote}</p>
              <ul>
                <li>원본 판면 · 국립중앙박물관</li>
                <li>현대 위치 · 한국철도공사 역 대표점</li>
                <li>현대 역 시설 · 국가철도공단 1905년 개업 기록</li>
                <li>행정 연혁 · 1416년 천안군</li>
              </ul>
            </figcaption>
          </figure>

          <div className={styles.interpretation}>
            <ShieldCheck aria-hidden="true" />
            <p>
              <strong>현대 천안역과 옛 지도의 천안 표기는 같은 점이 아닙니다.</strong>
              한국철도공사 역 대표점, 국가철도공단 개업 기록, 천안시 연혁과 판본
              표기를 대조해 권역 후보로만 보여줍니다.
            </p>
            {officialSource && (
              <a href={officialSource.recordUrl} target="_blank" rel="noreferrer">
                국립중앙박물관 원문 보기
                <ExternalLink aria-hidden="true" />
              </a>
            )}
          </div>
        </article>
      </div>

      <ol className={styles.progress} aria-label="천안군 권역 판면 대조 단계">
        <li data-complete="true"><span>1</span><b>현대 위치</b><small>천안역 공개 좌표</small></li>
        <li data-complete="true"><span>2</span><b>권역 후보</b><small>천안군 연혁 대조</small></li>
        <li data-active="true"><span>3</span><b>공식 판면</b><small>천안 표기 확대</small></li>
        <li><span>4</span><b>해석 한계</b><small>좌표 동일시 금지</small></li>
      </ol>
    </section>
  );
}
