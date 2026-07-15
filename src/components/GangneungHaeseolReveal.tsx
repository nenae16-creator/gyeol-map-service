import { publicAssetUrl } from "../utils/publicAssetUrl";

// '강릉'으로 답하면 실제 강릉 원본판(대동여지도 신유본 _80, 동해안·대관령·강릉부)을
// 클로즈업(zoom-in) 애니메이션으로 펼치고 판독 근거와 함께 설명한다.
// 이어서 '이 길을 찾아가기'로 절첩식 경로 + 선비 보행으로 넘어간다.

const GANGNEUNG_URL = publicAssetUrl("assets/gangneung-wonbon.jpg");

const CANDIDATES = [
  { hanja: "江陵", kor: "강릉", confidence: "높음" },
  { hanja: "臨瀛", kor: "임영", confidence: "높음" },
  { hanja: "溟州", kor: "명주", confidence: "보통" },
  { hanja: "何瑟羅", kor: "하슬라", confidence: "낮음" }
];

const EVIDENCE = [
  { title: "대동여지도에 '江陵' 표기", meta: "대동여지도 (1861)" },
  { title: "강릉대도호부(江陵大都護府) · 별호 임영", meta: "여지도서·읍지" },
  { title: "명주(溟州) 옛 지명", meta: "신라 757 ~ 고려" }
];

export function GangneungHaeseolReveal({ onGoRoute }: { onGoRoute: () => void }) {
  const styleText = `
    @keyframes gr-zoom {
      from { transform: scale(0.58); opacity: 0; }
      60% { opacity: 1; }
      to { transform: scale(1); opacity: 1; }
    }
    .gr-spread { animation: gr-zoom 1.4s cubic-bezier(0.16, 0.84, 0.32, 1) both; transform-origin: 74% 46%; }
    @media (prefers-reduced-motion: reduce) {
      .gr-spread { animation: none; opacity: 1; transform: none; }
    }
  `;

  return (
    <div
      aria-label="강릉 지역 고금지명 대조 지도 (실제 대동여지도 원본판)"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 20,
        background: "radial-gradient(120% 130% at 50% 0%, #e7ddc4 0%, #d8ccae 52%, #c9bc9a 100%)",
        padding: "clamp(14px, 2.4vw, 30px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: styleText }} />

      <div
        className="gr-spread"
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) clamp(210px, 26%, 320px)",
          gap: "clamp(12px, 1.8vw, 26px)",
          transformOrigin: "74% 46%"
        }}
      >
        <section style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <header style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, font: "700 clamp(24px, 3.4vw, 40px)/1 'Batang','바탕',serif", color: "#3a2f22", letterSpacing: "0.02em" }}>
              강릉 <span style={{ fontSize: "0.62em", color: "#6b5c44" }}>江陵大都護府</span>
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
              src={GANGNEUNG_URL}
              alt="1861년 대동여지도 신유본 강릉 일원 원본판 (동해·대관령·강릉부, 국립중앙박물관 신수19997)"
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "72% 50%", display: "block" }}
            />
          </div>

          <p style={{ margin: "10px 2px 0", font: "400 clamp(11px, 1.2vw, 13px)/1.5 'Malgun Gothic',sans-serif", color: "#6b5c44" }}>
            지도 제작 정보 · 대동여지도 신유본(1861) 강릉 일원 · 국립중앙박물관 소장 신수19997 ·{" "}
            <a href="https://www.kogl.or.kr/info/licenseType1.do" target="_blank" rel="noreferrer" style={{ color: "#8a5a2a" }}>
              공공누리 제1유형(출처표시)
            </a>
          </p>
        </section>

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
          <h2 style={{ margin: 0, textAlign: "center", font: "700 clamp(15px, 1.7vw, 19px)/1 'Batang','바탕',serif", color: "#7a1f1f", letterSpacing: "0.06em" }}>
            ◆ 판독 근거
          </h2>

          <div>
            <div style={{ font: "700 12px/1 'Batang','바탕',serif", color: "#3a2f22", padding: "6px 0", borderBottom: "1px solid rgba(90,70,44,0.3)", marginBottom: 8 }}>
              古地名 후보
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 7 }}>
              {CANDIDATES.map((c) => (
                <li key={c.hanja} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ color: "#7a1f1f", fontSize: 11 }}>■</span>
                  <span style={{ font: "700 clamp(14px, 1.5vw, 17px)/1.2 'Batang','바탕',serif", color: "#2f2619" }}>{c.hanja}</span>
                  <span style={{ font: "400 12px/1.2 'Malgun Gothic',sans-serif", color: "#5a4c38" }}>({c.kor})</span>
                  <span style={{ marginLeft: "auto", font: "400 11px/1.2 'Malgun Gothic',sans-serif", color: "#8a5a2a" }}>신뢰도 {c.confidence}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div style={{ font: "700 12px/1 'Batang','바탕',serif", color: "#3a2f22", padding: "6px 0", borderBottom: "1px solid rgba(90,70,44,0.3)", marginBottom: 8 }}>
              판독 근거
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 9 }}>
              {EVIDENCE.map((e) => (
                <li key={e.title}>
                  <div style={{ font: "600 clamp(12px, 1.3vw, 14px)/1.35 'Malgun Gothic',sans-serif", color: "#2f2619" }}>
                    <span style={{ color: "#7a1f1f", marginRight: 4 }}>•</span>
                    {e.title}
                  </div>
                  <div style={{ font: "400 11px/1.3 'Malgun Gothic',sans-serif", color: "#6b5c44", paddingLeft: 12 }}>— {e.meta}</div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div style={{ font: "700 12px/1 'Batang','바탕',serif", color: "#3a2f22", padding: "6px 0", borderBottom: "1px solid rgba(90,70,44,0.3)", marginBottom: 8 }}>
              메모
            </div>
            <p style={{ margin: 0, font: "400 clamp(12px, 1.3vw, 13px)/1.6 'Malgun Gothic',sans-serif", color: "#4a3d2b" }}>
              강릉은 강원도 동해안의 대도호부로, 대관령 동쪽 임영(臨瀛) 일대입니다. 관동대로가 대관령을 넘어 이곳에 닿습니다.
            </p>
          </div>

          <button
            type="button"
            onClick={onGoRoute}
            style={{
              marginTop: "auto",
              appearance: "none",
              border: "1px solid rgba(122,31,31,0.55)",
              background: "linear-gradient(180deg, #efe0c8, #e2d0ad)",
              color: "#5a1616",
              font: "700 clamp(14px, 1.5vw, 17px)/1.3 'Batang','바탕',serif",
              padding: "12px 16px",
              borderRadius: 10,
              cursor: "pointer"
            }}
          >
            이 길을 찾아가기 · 선비와 함께 →
          </button>
        </aside>
      </div>
    </div>
  );
}
