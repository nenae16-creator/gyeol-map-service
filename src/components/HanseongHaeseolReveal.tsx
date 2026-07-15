import { publicAssetUrl } from "../utils/publicAssetUrl";

const HANSEONG_MAP_URL = publicAssetUrl("assets/hanseong-haeseol-map.jpg");

// 한성부(서울) 선택 시 '서울 권역 한성부 古今地名 對照 해설도'를 확대 애니메이션으로 펼친다.
// 주의(정직성): 이 지도는 AI로 재구성한 해설·대조 일러스트이며 실제 판본 스캔이 아니다.
// 실판본 근거는 우측 '판독 근거' 및 국립중앙박물관 신수19997을 참조.
export function HanseongHaeseolReveal() {
  const styleText = `
    @keyframes hs-zoom {
      from { transform: scale(0.9); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    .hs-zoom { animation: hs-zoom 1.15s cubic-bezier(0.16, 0.84, 0.32, 1) both; }
    @media (prefers-reduced-motion: reduce) {
      .hs-zoom { animation: none; opacity: 1; transform: none; }
    }
  `;

  return (
    <div
      aria-label="서울 권역 한성부 고금지명 대조 해설 지도"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 15,
        background: "#0b0d12",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden"
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: styleText }} />
      <img
        className="hs-zoom"
        src={HANSEONG_MAP_URL}
        alt="서울 권역 한성부 고금지명 대조 해설 지도. 한성·한양·경성·한경 후보와 판독 근거를 함께 보여준다."
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          transformOrigin: "50% 46%"
        }}
      />
      <span
        style={{
          position: "absolute",
          right: "1.4%",
          bottom: "2.2%",
          padding: "4px 10px",
          borderRadius: 8,
          background: "rgba(10,12,16,0.6)",
          color: "#c8ccd4",
          font: "400 11px/1.2 'Malgun Gothic',sans-serif",
          letterSpacing: "0.02em",
          pointerEvents: "none"
        }}
      >
        古今地名 對照 해설도 · AI 재구성(실판본 아님)
      </span>
    </div>
  );
}
