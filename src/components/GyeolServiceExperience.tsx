import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  ChevronDown,
  Database,
  ExternalLink,
  Landmark,
  LoaderCircle,
  LocateFixed,
  MapPin,
  MapPinned,
  Navigation,
  RotateCcw,
  Search,
  ShieldCheck
} from "lucide-react";
import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  demoPlaces,
  findDemoPlace,
  isInsideSeoulDemoArea
} from "../data/gyeolDemo";
import { resolveGyeolResult } from "../data/gyeolClient";
import { buildCuratedFallback } from "../data/gyeolFallback";
import type {
  DemoPlace,
  EvidenceItem,
  GyeolResultEnvelope,
  SourceReference
} from "../domain/gyeolEvidence";
import { publicAssetUrl } from "../utils/publicAssetUrl";
import { InteractiveDaedongMapIntro } from "./InteractiveDaedongMapIntro";
import styles from "./GyeolServiceExperience.module.css";

type ServiceStage = "idle" | "decoding" | "result" | "journey";

const SERVICE_PLATE_URL = publicAssetUrl("assets/gyeol-service-desk-plate.png");
const MAP_URL = publicAssetUrl("assets/daedongyeojido-idle-toned-v2.png");

const decodeSteps = [
  {
    label: "현재 위치 확인",
    description: "현대 장소와 행정구역을 확인합니다.",
    icon: LocateFixed
  },
  {
    label: "옛지명 권역 후보 대조",
    description: "현대 위치와 역사 지명 후보를 비교합니다.",
    icon: MapPinned
  },
  {
    label: "대동여지도 판본 확인",
    description: "실제 판본의 관련 영역과 메타데이터를 찾습니다.",
    icon: Landmark
  },
  {
    label: "근거형 답변 구성",
    description: "판본·공공데이터·추정을 구분해 정리합니다.",
    icon: ShieldCheck
  }
] as const;

const serviceSteps = [
  { label: "현재 위치", description: "장소와 질문 입력" },
  { label: "옛지명 해독", description: "권역 후보 대조" },
  { label: "근거 확인", description: "판본·데이터·추정" },
  { label: "지도 체험", description: "관련 지도 펼치기" }
] as const;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function evidenceIcon(item: EvidenceItem) {
  if (item.id === "edition") return Landmark;
  if (item.id === "public-data") return Database;
  return Navigation;
}

function statusClass(status: EvidenceItem["claimStatus"]) {
  if (status === "source-confirmed") return styles.statusVerified;
  if (status === "api-snapshot-confirmed") return styles.statusData;
  return styles.statusInference;
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${year}.${month}.${day}` : value;
}

function sourceLabel(source: SourceReference) {
  return `${source.organization} · ${source.recordTitle}`;
}

export function GyeolServiceExperience() {
  const [stage, setStage] = useState<ServiceStage>("idle");
  const [query, setQuery] = useState("서울시청");
  const [decodeStep, setDecodeStep] = useState(0);
  const [pendingResult, setPendingResult] = useState<GyeolResultEnvelope | null>(null);
  const [result, setResult] = useState<GyeolResultEnvelope | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const searchRef = useRef<HTMLInputElement | null>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const pendingResultRef = useRef<GyeolResultEnvelope | null>(null);
  const decodeRequestRef = useRef(0);

  const activeServiceStep = stage === "idle" ? 0 : stage === "decoding" ? 1 : stage === "result" ? 2 : 3;
  const visibleResult = result ?? pendingResult;

  const liveMessage = useMemo(() => {
    if (notice) return notice;
    if (locating) return "현재 위치를 확인하고 있습니다.";
    if (stage === "decoding") return decodeSteps[decodeStep]?.label ?? "위치를 해독하고 있습니다.";
    if (stage === "result" && result) return `${result.candidate.name} 결과가 준비되었습니다.`;
    return "장소를 검색하거나 현재 위치를 사용해 옛지명을 해독할 수 있습니다.";
  }, [decodeStep, locating, notice, result, stage]);

  useEffect(() => {
    if (stage !== "decoding" || !pendingResultRef.current) return;

    const reduced = prefersReducedMotion();
    const timings = reduced ? [40, 80, 120] : [520, 1080, 1640];
    const finishAt = reduced ? 180 : 2320;
    const timers = timings.map((delay, index) =>
      window.setTimeout(() => setDecodeStep(index + 1), delay)
    );

    timers.push(
      window.setTimeout(() => {
        const finalResult = pendingResultRef.current;
        if (!finalResult) return;
        setResult(finalResult);
        setStage("result");
      }, finishAt)
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [stage]);

  useEffect(() => {
    if (stage !== "result" || !result) return;
    resultHeadingRef.current?.focus({ preventScroll: true });
  }, [result, stage]);

  const beginDecode = (place: DemoPlace) => {
    const requestId = decodeRequestRef.current + 1;
    decodeRequestRef.current = requestId;
    const initialResult = buildCuratedFallback(place);

    setNotice(null);
    setQuery(place.label);
    setResult(null);
    setPendingResult(initialResult);
    pendingResultRef.current = initialResult;
    setDecodeStep(0);
    setStage("decoding");

    void resolveGyeolResult(place).then((resolvedResult) => {
      if (decodeRequestRef.current !== requestId) return;
      pendingResultRef.current = resolvedResult;
      setPendingResult(resolvedResult);
    });
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const place = findDemoPlace(query);

    if (!place) {
      setNotice(
        "현재 시범 서비스는 서울시청·광화문·경복궁 인근만 해독할 수 있습니다. 지원되는 예시 장소를 선택해 주세요."
      );
      searchRef.current?.focus();
      return;
    }

    beginDecode(place);
  };

  const useCurrentLocation = () => {
    setNotice(null);

    if (!("geolocation" in navigator)) {
      setNotice("이 브라우저에서는 현재 위치를 사용할 수 없습니다. 장소명을 직접 검색해 주세요.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);

        if (!isInsideSeoulDemoArea(coords.latitude, coords.longitude)) {
          setNotice(
            "확인된 위치는 현재 시범 해독 권역 밖입니다. 결과를 임의로 만들지 않고 서울시청 예시만 제공합니다."
          );
          return;
        }

        beginDecode({
          ...demoPlaces[0],
          id: "browser-location",
          label: "현재 위치",
          adminLabel: "서울 도성권 시범 범위",
          latitude: coords.latitude,
          longitude: coords.longitude,
          aliases: []
        });
      },
      (error) => {
        setLocating(false);
        setNotice(
          error.code === error.PERMISSION_DENIED
            ? "위치 권한을 사용할 수 없습니다. 장소를 직접 검색하거나 서울시청 예시를 선택해 주세요."
            : "현재 위치를 확인하지 못했습니다. 장소명을 직접 입력해 주세요."
        );
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 }
    );
  };

  const resetService = () => {
    decodeRequestRef.current += 1;
    setStage("idle");
    setDecodeStep(0);
    setPendingResult(null);
    pendingResultRef.current = null;
    setResult(null);
    setNotice(null);
    window.setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 0);
  };

  if (stage === "journey") {
    return (
      <main className={styles.journeyShell} aria-label="한성부 권역 지도 체험">
        <InteractiveDaedongMapIntro
          autoStart
          selectedPlaceId={result?.place.id}
          selectedPlace={result?.place}
          mapRegions={result?.mapRegions}
        />
        <button className={styles.backToResult} type="button" onClick={() => setStage("result")}>
          <ArrowLeft aria-hidden="true" />
          근거 결과로 돌아가기
        </button>
      </main>
    );
  }

  const mapRegion = visibleResult?.mapRegions.find(
    (region) => region.id === "local-hanseong-provisional"
  );
  const markerStyle = {
    "--marker-x": `${(mapRegion?.point.x ?? 0.349695) * 100}%`,
    "--marker-y": `${(mapRegion?.point.y ?? 0.44069) * 100}%`
  } as CSSProperties;

  return (
    <main className={styles.serviceRoot} aria-label="현재 위치를 옛지명으로 해독하는 결 서비스">
      <section
        className={styles.scene}
        data-stage={stage}
        aria-busy={stage === "decoding" || locating}
      >
        <img className={styles.backdrop} src={SERVICE_PLATE_URL} alt="" aria-hidden="true" />

        <form className={styles.searchForm} role="search" onSubmit={handleSearch}>
          <label className={styles.srOnly} htmlFor="gyeol-place-search">
            해독할 현대 장소 또는 질문
          </label>
          <Search className={styles.searchIcon} aria-hidden="true" />
          <input
            ref={searchRef}
            id="gyeol-place-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="서울시청, 광화문처럼 장소를 입력하세요"
            autoComplete="off"
          />
          <button type="submit" aria-label="입력한 장소를 옛지명으로 해독하기">
            해독
          </button>
        </form>

        <button
          className={styles.locationButton}
          type="button"
          onClick={useCurrentLocation}
          disabled={locating || stage === "decoding"}
        >
          {locating ? <LoaderCircle className={styles.spin} aria-hidden="true" /> : <LocateFixed aria-hidden="true" />}
          {locating ? "위치 확인 중" : "현재 위치 사용"}
        </button>

        <div className={styles.workspace}>
          <figure className={styles.mapShell}>
            <div className={styles.mapImageLayer}>
              <img
                className={styles.mapUnderlay}
                src={MAP_URL}
                alt=""
                aria-hidden="true"
              />
              <img
                className={styles.mapArtwork}
                src={MAP_URL}
                alt="1861년 대동여지도 판본을 참고해 제작한 로컬 시범 지도 자산"
              />
              <button
                className={styles.candidateMarker}
                style={markerStyle}
                type="button"
                hidden={stage === "idle"}
                aria-label="한양·한성부 권역 후보 설명으로 이동"
                onClick={() => resultHeadingRef.current?.focus({ preventScroll: true })}
              >
                <MapPin aria-hidden="true" />
                <span>한성부 권역 후보</span>
              </button>
            </div>
            <figcaption>
              <span>로컬 좌표 임시 등록</span>
              공식 판본의 첩·면 좌표와 역사 경계는 아직 검수 전입니다.
            </figcaption>
          </figure>

          <section className={styles.servicePanel} aria-live="off">
            {stage === "idle" && (
              <div className={styles.askPanel}>
                <p className={styles.eyebrow}>현재 위치를 옛 지도의 언어로</p>
                <h1>
                  제가 지금 있는 곳은
                  <br />
                  대동여지도에서 어디였나요?
                </h1>

                <div className={styles.currentPlaceCard}>
                  <MapPinned aria-hidden="true" />
                  <span>
                    <small>첫 시범 위치</small>
                    서울시청 · 서울특별시 중구
                  </span>
                </div>

                <button className={styles.primaryButton} type="button" onClick={() => beginDecode(demoPlaces[0])}>
                  서울시청 예시로 해독하기
                  <ArrowRight aria-hidden="true" />
                </button>

                <div className={styles.exampleArea}>
                  <span>검증 중인 서울 도성권 예시</span>
                  <div>
                    {demoPlaces.map((place) => (
                      <button key={place.id} type="button" onClick={() => beginDecode(place)}>
                        {place.label}
                      </button>
                    ))}
                  </div>
                </div>

                <p className={styles.cautionText}>
                  <ShieldCheck aria-hidden="true" />
                  결과는 정확한 좌표가 아니라 판본과 공공데이터를 근거로 한 권역 후보로 제시합니다.
                </p>
              </div>
            )}

            {stage === "decoding" && visibleResult && (
              <div className={styles.decodePanel} role="status" aria-live="polite">
                <p className={styles.eyebrow}>GYEOL 해독 과정</p>
                <h2>위치를 옛지명으로 번역하고 있습니다</h2>
                <p className={styles.placeLine}>
                  <MapPin aria-hidden="true" />
                  {visibleResult.place.label} · {visibleResult.place.adminLabel}
                </p>

                <ol className={styles.decodeList}>
                  {decodeSteps.map((step, index) => {
                    const StepIcon = step.icon;
                    const isComplete = index < decodeStep;
                    const isActive = index === decodeStep;

                    return (
                      <li
                        key={step.label}
                        data-active={isActive}
                        data-complete={isComplete}
                        aria-current={isActive ? "step" : undefined}
                      >
                        <span className={styles.decodeIcon}>
                          {isComplete ? (
                            <Check aria-hidden="true" />
                          ) : isActive ? (
                            <LoaderCircle className={styles.spin} aria-hidden="true" />
                          ) : (
                            <StepIcon aria-hidden="true" />
                          )}
                        </span>
                        <span>
                          <strong>{step.label}</strong>
                          <small>{step.description}</small>
                        </span>
                      </li>
                    );
                  })}
                </ol>

                <p className={styles.demoNotice}>
                  {visibleResult.delivery.label}을 불러왔습니다. 지원하지 않는 위치의 결과는 임의로 만들지 않습니다.
                </p>
              </div>
            )}

            {stage === "result" && result && (
              <div className={styles.resultPanel}>
                <div className={styles.resultHeadingRow}>
                  <p className={styles.eyebrow}>해독 결과 · 권역 후보 1개</p>
                  <span className={styles.inferenceBadge}>{result.candidate.label}</span>
                </div>

                <h2 ref={resultHeadingRef} tabIndex={-1}>
                  {result.candidate.name}
                </h2>
                <p className={styles.hanja}>{result.candidate.hanja}</p>
                <p className={styles.answerSummary}>{result.candidate.summary}</p>
                <p className={styles.answerLimitation}>{result.candidate.limitation}</p>

                <div className={styles.deliveryNotice} data-mode={result.delivery.mode}>
                  <Database aria-hidden="true" />
                  <span>
                    <strong>{result.delivery.label}</strong>
                    <small>{result.delivery.warning}</small>
                  </span>
                </div>

                <div className={styles.evidenceHeading}>
                  <span>판정 근거</span>
                  <small>{result.evidence.length}개의 근거 묶음</small>
                </div>

                <div className={styles.evidenceList}>
                  {result.evidence.map((item, index) => {
                    const EvidenceIcon = evidenceIcon(item);
                    const itemSources = item.sourceIds
                      .map((sourceId) => result.sources.find((source) => source.id === sourceId))
                      .filter((source): source is SourceReference => Boolean(source));
                    const itemRegion = item.mapRegionId
                      ? result.mapRegions.find((region) => region.id === item.mapRegionId)
                      : undefined;

                    return (
                      <details key={item.id} open={index === 0}>
                        <summary>
                          <span className={styles.evidenceIcon}>
                            <EvidenceIcon aria-hidden="true" />
                          </span>
                          <span className={styles.evidenceTitle}>
                            <small>{item.eyebrow}</small>
                            <strong>{item.title}</strong>
                          </span>
                          <span className={`${styles.statusBadge} ${statusClass(item.claimStatus)}`}>
                            {item.status}
                          </span>
                          <ChevronDown className={styles.detailsChevron} aria-hidden="true" />
                        </summary>
                        <div className={styles.evidenceBody}>
                          <p>{item.description}</p>
                          {itemRegion && (
                            <p className={styles.registrationNote}>
                              <MapPinned aria-hidden="true" />
                              <span>
                                <strong>좌표 상태 · 시각적 임시 등록</strong>
                                {itemRegion.reviewNote}
                              </span>
                            </p>
                          )}
                          {itemSources.length > 0 && (
                            <ul className={styles.sourceList} aria-label={`${item.title} 출처`}>
                              {itemSources.map((source) => (
                                <li key={source.id}>
                                  <a href={source.recordUrl} target="_blank" rel="noreferrer">
                                    {sourceLabel(source)}
                                    <ExternalLink aria-hidden="true" />
                                  </a>
                                  <span>
                                    {source.datasetId
                                      ? `데이터셋 ${source.datasetId}`
                                      : `소장품번호 ${source.recordId}`}
                                    {` · 접근일 ${formatDate(source.accessedAt)} · ${source.license.name}`}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </details>
                    );
                  })}
                </div>

                <div className={styles.resultActions}>
                  <button className={styles.primaryButton} type="button" onClick={() => setStage("journey")}>
                    <BookOpenCheck aria-hidden="true" />
                    한성부 권역 지도 체험하기
                  </button>
                  <button className={styles.secondaryButton} type="button" onClick={resetService}>
                    <RotateCcw aria-hidden="true" />
                    다른 위치 찾기
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {notice && (
          <div className={styles.notice} role="alert">
            <ShieldCheck aria-hidden="true" />
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="안내 닫기">
              닫기
            </button>
          </div>
        )}

        <nav className={styles.progressBar} aria-label="서비스 진행 단계">
          <ol>
            {serviceSteps.map((step, index) => {
              const complete = index < activeServiceStep;
              const active = index === activeServiceStep;

              return (
                <li key={step.label} data-active={active} data-complete={complete} aria-current={active ? "step" : undefined}>
                  <span className={styles.stepNumber}>{complete ? <Check aria-hidden="true" /> : index + 1}</span>
                  <span>
                    <strong>{step.label}</strong>
                    <small>{step.description}</small>
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>

        <p className={styles.srOnly} aria-live="polite">
          {liveMessage}
        </p>
      </section>
    </main>
  );
}
