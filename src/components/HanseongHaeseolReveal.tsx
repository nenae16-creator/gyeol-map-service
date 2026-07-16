import { publicAssetUrl } from "../utils/publicAssetUrl";

// 한성부(서울) 선택 시 실제 국립중앙박물관 도성도(신수19997)를
// '서울 권역 한성부 古今地名 對照 지도' 형태로, 판독 근거 패널과 함께 확대(zoom-in)로 펼친다.
// 표시 지도는 실제 판본 스캔이며, 공공누리 제1유형으로 출처를 표기한다.

// 한성 원본판: 대동여지도 신유본 도성도(채색) — 국립중앙박물관 신수19997 (E드라이브 원본 _6).
const DOSEONGDO_URL = publicAssetUrl("assets/hanseong-doseongdo-wonbon.jpg");

const CANDIDATES = [
  { hanja: "漢城", kor: "한성", confidence: "높음" },
  { hanja: "漢陽", kor: "한양", confidence: "높음" },
  { hanja: "京城", kor: "경성", confidence: "보통" },
  { hanja: "漢京", kor: "한경", confidence: "낮음" }
];

const EVIDENCE = [
  { title: "대동여지도에 '漢城' 표기", meta: "대동여지도 (1861)" },
  { title: "동국문헌비고 '漢城府' 기록", meta: "동국문헌비고 (1770)" },
  { title: "여지도서 '漢城府' 표기", meta: "여지도서 (1757)" },
  { title: "승정원일기 '漢城' 언급 다수", meta: "승정원일기 (조선)" }
];

export function HanseongHaeseolReveal() {
  const styleText = `
    @keyframes hs-zoom {
      from { transform: scale(0.58); opacity: 0; }
      60% { opacity: 1; }
      to { transform: scale(1); opacity: 1; }
    }
    .hs-spread { animation: hs-zoom 1.4s cubic-bezier(0.16, 0.84, 0.32, 1) both; transform-origin: 62% 46%; }
    @media (prefers-reduced-motion: reduce) {
      .hs-spread { animation: none; opacity: 1; transform: none; }
    }
  `;

  return (
    <div
      aria-label="서울 권역 한성부 고금지명 대조 지도 (실제 도성도 판본)"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 15,
        background: "radial-gradient(120% 130% at 50% 0%, #e7ddc4 0%, #d8ccae 52%, #c9bc9a 100%)",
        padding: "clamp(14px, 2.4vw, 30px)",
        overflow: "hidden"
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: styleText }} />

      <div
        className="hs-spread"
        style={{
          height: "100%",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) clamp(210px, 26%, 320px)",
          gap: "clamp(12px, 1.8vw, 26px)",
          transformOrigin: "50% 42%"
        }}
      >
        {/* 지도 영역 */}
        <section style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <header style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
            <h1
              style={{
                margin: 0,
                font: "700 clamp(24px, 3.4vw, 40px)/1 'Batang','바탕',serif",
                color: "#3a2f22",
                letterSpacing: "0.02em"
              }}
            >
              서울 권역 <span style={{ fontSize: "0.62em", color: "#6b5c44" }}>한성부</span>
            </h1>
            <span style={{ font: "400 clamp(11px, 1.3vw, 15px)/1 'Batang','바탕',serif", color: "#7a6a50" }}>
              古今地名 對照 지도
            </span>
          </header>

          <div
            style={{
              position: "relative",
              flex: 1,
              minHeight: 0,
              marginTop: 12,
              borderRadius: 6,
              border: "1px solid rgba(90,70,44,0.4)",
              boxShadow: "0 10px 30px rgba(60,45,26,0.28), inset 0 0 40px rgba(120,96,60,0.25)",
              overflow: "hidden",
              background: "#efe7d2"
            }}
          >
            <img
              src={DOSEONGDO_URL}
              alt="1861년 대동여지도 신유본 도성도 채색 원본판 (국립중앙박물관 신수19997)"
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          </div>

          <p
            style={{
              margin: "10px 2px 0",
              font: "400 clamp(11px, 1.2vw, 13px)/1.5 'Malgun Gothic',sans-serif",
              color: "#6b5c44"
            }}
          >
            지도 제작 정보 · 대동여지도 신유본(1861) 도성도 · 국립중앙박물관 소장 신수19997 ·{" "}
            <a
              href="https://www.kogl.or.kr/info/licenseType1.do"
              target="_blank"
              rel="noreferrer"
              style={{ color: "#8a5a2a" }}
            >
              공공누리 제1유형(출처표시)
            </a>
          </p>
        </section>

        {/* 판독 근거 패널 */}
        <aside
          style={{
            background: "linear-gradient(180deg, #efe7d1, #e6dcc0)",
            border: "1px solid rgba(90,70,44,0.4)",
            borderRadius: 8,
            padding: "clamp(14px, 1.6vw, 22px)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            overflow: "auto",
            boxShadow: "inset 0 0 30px rgba(150,120,74,0.18)"
          }}
        >
          <h2
            style={{
              margin: 0,
              textAlign: "center",
              font: "700 clamp(15px, 1.7vw, 19px)/1 'Batang','바탕',serif",
              color: "#7a1f1f",
              letterSpacing: "0.06em"
            }}
          >
            ◆ 판독 근거
          </h2>

          <div>
            <div
              style={{
                font: "700 12px/1 'Batang','바탕',serif",
                color: "#3a2f22",
                padding: "6px 0",
                borderBottom: "1px solid rgba(90,70,44,0.3)",
                marginBottom: 8
              }}
            >
              古地名 후보
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 7 }}>
              {CANDIDATES.map((c) => (
                <li key={c.hanja} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ color: "#7a1f1f", fontSize: 11, lineHeight: 1.4 }}>■</span>
                  <span style={{ font: "700 clamp(14px, 1.5vw, 17px)/1.2 'Batang','바탕',serif", color: "#2f2619" }}>
                    {c.hanja}
                  </span>
                  <span style={{ font: "400 12px/1.2 'Malgun Gothic',sans-serif", color: "#5a4c38" }}>
                    ({c.kor})
                  </span>
                  <span style={{ marginLeft: "auto", font: "400 11px/1.2 'Malgun Gothic',sans-serif", color: "#8a5a2a" }}>
                    신뢰도 {c.confidence}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div
              style={{
                font: "700 12px/1 'Batang','바탕',serif",
                color: "#3a2f22",
                padding: "6px 0",
                borderBottom: "1px solid rgba(90,70,44,0.3)",
                marginBottom: 8
              }}
            >
              판독 근거
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 9 }}>
              {EVIDENCE.map((e) => (
                <li key={e.title}>
                  <div style={{ font: "600 clamp(12px, 1.3vw, 14px)/1.35 'Malgun Gothic',sans-serif", color: "#2f2619" }}>
                    <span style={{ color: "#7a1f1f", marginRight: 4 }}>•</span>
                    {e.title}
                  </div>
                  <div style={{ font: "400 11px/1.3 'Malgun Gothic',sans-serif", color: "#6b5c44", paddingLeft: 12 }}>
                    — {e.meta}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div
              style={{
                font: "700 12px/1 'Batang','바탕',serif",
                color: "#3a2f22",
                padding: "6px 0",
                borderBottom: "1px solid rgba(90,70,44,0.3)",
                marginBottom: 8
              }}
            >
              메모
            </div>
            <p style={{ margin: 0, font: "400 clamp(12px, 1.3vw, 13px)/1.6 'Malgun Gothic',sans-serif", color: "#4a3d2b" }}>
              한성부는 조선의 수도로 도성(都城)을 중심으로 사대문과 한강이 주요 지형입니다.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
