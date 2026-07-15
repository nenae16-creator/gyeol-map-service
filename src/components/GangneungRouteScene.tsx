import { useMemo } from "react";
import { publicAssetUrl } from "../utils/publicAssetUrl";

// 한양에서 강릉까지, 실제 관동대로(경흥로·평해로)를 판본 회랑 위에 재구성한 경로 체험.
// 절첩식(접이식) 지도가 펼쳐지며 길이 만들어지고, 영상에서 쓴 실제 선비가 그 길을 걸어간다.
// CSS 애니메이션 기반(요청: 실제 관동대로 정교화, 브라우저 RAF 스로틀에도 견고).

const CORRIDOR_URL = publicAssetUrl("assets/gyeol-gangneung-corridor.jpg");
const SEONBI_URL = publicAssetUrl("assets/seonbi-walk-sheet.png");
const VB_W = 1000;
const VB_H = 543;
const FOLD_PANELS = 8;
// 절첩식(아코디언): 접힌 상태는 각 폭이 FOLD_ANGLE만큼 접혀 가로로 압축(cos), 펼치면 평평해진다.
const FOLD_ANGLE = 74;
const FOLD_COMPRESS = Math.cos((FOLD_ANGLE * Math.PI) / 180);
const PANEL_W = 100 / FOLD_PANELS;
const SEONBI_FRAMES = 8;
const SEONBI_SHEET_W = 1200; // 8 * 150
const SEONBI_SHEET_H = 214;

type Point = [number, number];

type Waypoint = { name: string; x: number; y: number; mark?: "start" | "peak" | "end" };

// 관동대로 역참 고증(한양·양근·원주·방림·진부·대관령·강릉)을 회랑 좌표(0~1)로 정규화.
const WAYPOINTS: Waypoint[] = [
  { name: "한양", x: 0.131, y: 0.424, mark: "start" },
  { name: "양근", x: 0.291, y: 0.544 },
  { name: "원주", x: 0.471, y: 0.656 },
  { name: "방림", x: 0.623, y: 0.6 },
  { name: "진부", x: 0.709, y: 0.544 },
  { name: "대관령", x: 0.8, y: 0.52, mark: "peak" },
  { name: "강릉 江陵", x: 0.86, y: 0.473, mark: "end" }
];

function catmull(points: Point[], seg = 26): Point[] {
  const q = [points[0], ...points, points[points.length - 1]];
  const out: Point[] = [];
  for (let i = 1; i < q.length - 2; i += 1) {
    const p0 = q[i - 1];
    const p1 = q[i];
    const p2 = q[i + 1];
    const p3 = q[i + 2];
    for (let t = 0; t < seg; t += 1) {
      const u = t / seg;
      const u2 = u * u;
      const u3 = u2 * u;
      const x =
        0.5 *
        (2 * p1[0] +
          (-p0[0] + p2[0]) * u +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3);
      const y =
        0.5 *
        (2 * p1[1] +
          (-p0[1] + p2[1]) * u +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3);
      out.push([x, y]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

const UNFOLD_SECONDS = 0.72;
const UNFOLD_STAGGER = 0.16;
const REVEAL_DELAY = FOLD_PANELS * UNFOLD_STAGGER + UNFOLD_SECONDS + 0.2; // 완전히 펼쳐진 뒤 길·선비 시작
const WALK_SECONDS = 5.6;
const SEONBI_CYCLE = 0.62;
// 강릉에 도착하면 걷기를 멈춘다(보행 시간만큼만 다리 순환, 이후 마지막 프레임 유지).
const SEONBI_STEPS_COUNT = Math.max(1, Math.round(WALK_SECONDS / SEONBI_CYCLE));

export function GangneungRouteScene({ onBack }: { onBack: () => void }) {
  const model = useMemo(() => {
    const normalized: Point[] = WAYPOINTS.map((point) => [point.x, point.y]);
    const dense = catmull(normalized).map(([x, y]) => [x * VB_W, y * VB_H] as Point);

    const pathD =
      "M " + dense.map((point) => `${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(" L ");

    let pathLength = 0;
    const cumulative = [0];
    for (let i = 1; i < dense.length; i += 1) {
      pathLength += Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
      cumulative.push(pathLength);
    }

    const step = VB_W * 0.021;
    const dots: Array<{ x: number; y: number; delay: number }> = [];
    let acc = 0;
    for (let i = 1; i < dense.length; i += 1) {
      acc += Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
      if (acc >= step) {
        acc = 0;
        const fraction = pathLength ? cumulative[i] / pathLength : 0;
        dots.push({ x: dense[i][0], y: dense[i][1], delay: REVEAL_DELAY + fraction * WALK_SECONDS });
      }
    }

    const wpCumulative = [0];
    for (let i = 1; i < normalized.length; i += 1) {
      wpCumulative.push(
        wpCumulative[i - 1] +
          Math.hypot(normalized[i][0] - normalized[i - 1][0], normalized[i][1] - normalized[i - 1][1])
      );
    }
    const wpTotal = wpCumulative[wpCumulative.length - 1] || 1;
    const walkStops = WAYPOINTS.map((point, index) => {
      const percent = ((wpCumulative[index] / wpTotal) * 100).toFixed(1);
      return `${percent}% { left: ${(point.x * 100).toFixed(2)}%; top: ${(point.y * 100).toFixed(2)}%; }`;
    }).join(" ");

    return { pathD, pathLength, dots, walkStops };
  }, []);

  const end = WAYPOINTS[WAYPOINTS.length - 1];
  const start = WAYPOINTS[0];

  // 폭마다 '접힌 위치 → 펼친 위치'로 이동+회전 → 실제 아코디언처럼 좌에서 우로 펼쳐진다.
  const foldKeyframes = Array.from({ length: FOLD_PANELS })
    .map((_, i) => {
      const flatLeft = (i * PANEL_W).toFixed(3);
      const foldLeft = (i * PANEL_W * FOLD_COMPRESS).toFixed(3);
      const angle = i % 2 === 0 ? FOLD_ANGLE : -FOLD_ANGLE;
      return `@keyframes gg-unfold-${i} {
        from { left:${foldLeft}%; transform: rotateY(${angle}deg); }
        to { left:${flatLeft}%; transform: rotateY(0deg); }
      }`;
    })
    .join("\n");

  const styleText = `
    ${foldKeyframes}
    @keyframes gg-draw { to { stroke-dashoffset: 0; } }
    @keyframes gg-fade { to { opacity: 1; } }
    @keyframes gg-walk { ${model.walkStops} }
    @keyframes gg-seonbi-steps { from { background-position-x: 0px; } to { background-position-x: -${SEONBI_SHEET_W}px; } }

    .gg-fold-panel { position:absolute; top:0; height:100%; background-image:url(${CORRIDOR_URL});
      background-repeat:no-repeat; background-size:${FOLD_PANELS * 100}% 100%; backface-visibility:hidden;
      border-left:1px solid rgba(74,56,32,0.34); border-right:1px solid rgba(255,244,214,0.10); }
    /* 접힘 자국 명암: 폭마다 교차 음영 → 펼쳐진 뒤에도 지그재그 입체감이 남는다 */
    .gg-fold-shade { position:absolute; inset:0; pointer-events:none; }
    .gg-fold-shade.a { background:linear-gradient(90deg, rgba(28,18,6,0.34), rgba(28,18,6,0.02) 46%, rgba(255,246,220,0.12) 82%, rgba(28,18,6,0.20)); }
    .gg-fold-shade.b { background:linear-gradient(270deg, rgba(28,18,6,0.34), rgba(28,18,6,0.02) 46%, rgba(255,246,220,0.12) 82%, rgba(28,18,6,0.20)); }
    .gg-road { stroke-dasharray:${model.pathLength.toFixed(1)}; stroke-dashoffset:${model.pathLength.toFixed(1)};
      animation: gg-draw ${WALK_SECONDS}s ease-in-out ${REVEAL_DELAY}s forwards; }
    .gg-dot { opacity:0; animation: gg-fade 0.35s ease-out forwards; }
    .gg-reveal { opacity:0; animation: gg-fade 0.5s ease-out ${REVEAL_DELAY}s forwards; }
    .gg-seonbi-wrap { position:absolute; left:${(start.x * 100).toFixed(2)}%; top:${(start.y * 100).toFixed(2)}%;
      width:0; height:0; opacity:0;
      animation: gg-fade 0.3s ease-out ${REVEAL_DELAY}s forwards,
                 gg-walk ${WALK_SECONDS}s ease-in-out ${REVEAL_DELAY}s forwards; }
    .gg-seonbi-sprite { position:absolute; left:0; top:0; width:150px; height:${SEONBI_SHEET_H}px;
      transform: translate(-50%, -100%) scale(0.3); transform-origin:50% 100%;
      background-image:url(${SEONBI_URL}); background-repeat:no-repeat;
      background-size:${SEONBI_SHEET_W}px ${SEONBI_SHEET_H}px;
      animation: gg-seonbi-steps ${SEONBI_CYCLE}s steps(${SEONBI_FRAMES}) ${REVEAL_DELAY}s ${SEONBI_STEPS_COUNT} both;
      filter:drop-shadow(0 4px 5px rgba(0,0,0,0.45)); }
    @media (prefers-reduced-motion: reduce) {
      /* 접힘 연출 없이 즉시 펼쳐진 상태로(애니메이션은 fill로 끝상태 유지) */
      .gg-fold-panel { animation-duration:0.001s !important; animation-delay:0s !important; }
      .gg-road { animation:none; stroke-dashoffset:0; }
      .gg-dot, .gg-reveal, .gg-seonbi-wrap { animation:none; opacity:1; }
      .gg-seonbi-wrap { left:${(end.x * 100).toFixed(2)}%; top:${(end.y * 100).toFixed(2)}%; }
      .gg-seonbi-sprite { animation:none; }
    }
  `;

  return (
    <div
      role="group"
      aria-label="접이식 지도가 펼쳐지며 선비가 한양에서 강릉까지 관동대로를 걷는 경로 체험"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        // 나무 책상 위에 절첩 지도를 펼치는 느낌
        background:
          "radial-gradient(120% 100% at 50% 30%, #4a3626 0%, #3a2a1b 38%, #2a1e13 68%, #1b130c 100%)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: styleText }} />

      <div style={{ position: "relative", flex: 1, minHeight: 0, perspective: "1500px" }}>
        {/* 절첩식 지도 펼침 — 접힌 책이 펼쳐지며 회랑(길 바탕)이 드러난다 */}
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
          {Array.from({ length: FOLD_PANELS }).map((_, index) => {
            const isLeftHinge = index % 2 === 0;
            return (
              <div
                key={index}
                className="gg-fold-panel"
                aria-hidden="true"
                style={{
                  left: `${(index * PANEL_W * FOLD_COMPRESS).toFixed(3)}%`,
                  width: `${PANEL_W}%`,
                  backgroundPositionX: `${(index / (FOLD_PANELS - 1)) * 100}%`,
                  transformOrigin: isLeftHinge ? "left center" : "right center",
                  transform: `rotateY(${isLeftHinge ? FOLD_ANGLE : -FOLD_ANGLE}deg)`,
                  animation: `gg-unfold-${index} ${UNFOLD_SECONDS}s cubic-bezier(0.22,0.92,0.28,1) ${index * UNFOLD_STAGGER}s both`,
                  filter: "brightness(0.86) saturate(0.94)"
                }}
              >
                <span className={`gg-fold-shade ${isLeftHinge ? "a" : "b"}`} />
              </div>
            );
          })}
        </div>

        <div
          className="gg-reveal"
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(8,10,14,0.5), rgba(8,10,14,0.04) 26%, rgba(8,10,14,0.38))"
          }}
        />

        <svg
          className="gg-reveal"
          aria-hidden="true"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          <path
            className="gg-road"
            d={model.pathD}
            fill="none"
            stroke="#e6c574"
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {model.dots.map((dot, index) => (
            <circle
              key={index}
              className="gg-dot"
              cx={dot.x}
              cy={dot.y}
              r={3.3}
              fill="#f4d98a"
              style={{ animationDelay: `${dot.delay.toFixed(2)}s` }}
            />
          ))}
        </svg>

        {WAYPOINTS.filter((point) => point.mark).map((point) => {
          const color = point.mark === "end" ? "#5ecfc4" : "#e6c574";
          return (
            <div
              key={point.name}
              className="gg-reveal"
              style={{
                position: "absolute",
                left: `${point.x * 100}%`,
                top: `${point.y * 100}%`,
                transform: "translate(-50%, -50%)",
                textAlign: "center",
                pointerEvents: "none",
                zIndex: 5
              }}
            >
              <span
                style={{
                  display: "block",
                  width: 13,
                  height: 13,
                  margin: "0 auto",
                  borderRadius: "50%",
                  background: color,
                  border: "2px solid #fff"
                }}
              />
              <span
                style={{
                  display: "inline-block",
                  marginTop: 5,
                  padding: "2px 9px",
                  borderRadius: 14,
                  background: "rgba(10,12,16,0.82)",
                  color: "#f2ece0",
                  font: "600 clamp(11px, 1.2vw, 15px)/1.2 'Batang','바탕',serif",
                  whiteSpace: "nowrap"
                }}
              >
                {point.name}
              </span>
            </div>
          );
        })}

        {/* 영상에서 쓴 실제 선비 — 걷기 사이클 스프라이트가 관동대로를 따라 이동 */}
        <div className="gg-seonbi-wrap" aria-hidden="true" style={{ zIndex: 6 }}>
          <div className="gg-seonbi-sprite" />
        </div>

        <div
          className="gg-reveal"
          style={{
            position: "absolute",
            left: "clamp(18px, 3vw, 34px)",
            top: "clamp(16px, 3vw, 30px)",
            maxWidth: "min(46%, 460px)",
            zIndex: 7
          }}
        >
          <p
            style={{
              margin: 0,
              font: "600 12px/1 'Malgun Gothic',sans-serif",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#98a0ac"
            }}
          >
            관동대로 · 서울 → 강릉
          </p>
          <h2
            style={{
              margin: "6px 0 8px",
              font: "600 clamp(20px, 2.6vw, 30px)/1.2 'Batang','바탕',serif",
              color: "#e6c574"
            }}
          >
            판본에 그려진 옛 길을 따라
          </h2>
          <p
            style={{
              margin: 0,
              padding: "8px 12px",
              borderRadius: 9,
              background: "rgba(8,10,14,0.55)",
              font: "400 clamp(13px, 1.5vw, 15px)/1.55 'Malgun Gothic',sans-serif",
              color: "#f2ece0"
            }}
          >
            접이식 지도가 펼쳐지며 길이 이어집니다. 판본의 도로망을 근거로 한양에서 원주를 지나{" "}
            <strong style={{ color: "#e6c574" }}>대관령</strong>을 넘어 강릉까지, 옛{" "}
            <strong style={{ color: "#e6c574" }}>관동대로 약 오백스물다섯 리</strong>를 선비가 되짚습니다.
          </p>
          <p style={{ margin: "8px 0 0", font: "400 12px/1.5 'Malgun Gothic',sans-serif", color: "#98a0ac" }}>
            ※ 판본 도로망을 근거로 재구성한 경로 · 방점 하나 = 십 리(십리방점)
          </p>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          justifyContent: "center",
          padding: "14px 16px",
          background: "linear-gradient(180deg, rgba(11,13,18,0), #0b0d12 40%)"
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            appearance: "none",
            border: "1px solid #333a46",
            background: "#161a22",
            color: "#f2ece0",
            font: "400 14px/1 'Malgun Gothic',sans-serif",
            padding: "10px 18px",
            borderRadius: 10,
            cursor: "pointer"
          }}
        >
          한성부 도성도로 돌아가기
        </button>
      </div>
    </div>
  );
}
