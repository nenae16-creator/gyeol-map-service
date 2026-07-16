import { publicAssetUrl } from "../utils/publicAssetUrl";

// '어느 지역으로 가볼까요?' → 전체 지도(전도)에서 한성 때처럼 핀으로 강릉을 고른다.
// 핀 좌표는 눈대중이 아니라 정합으로 확정:
//  - 한양(현재 위치) 0.375, 0.5619  (도성 채색 검출 + 템플릿 매칭 NCC 0.60)
//  - 강릉(목적지)   0.631, 0.5684  (전도 확정값 0.6311/0.5691 → 템플릿 매칭 NCC 0.57)

const MAP_URL = publicAssetUrl("assets/daedongyeojido-idle-toned-v2.png");
const HANYANG = { x: 0.375, y: 0.5619 };
const GANGNEUNG = { x: 0.631, y: 0.5684 };

export function GangneungPickScene({ onPick }: { onPick: () => void }) {
  const styleText = `
    @keyframes gp-in { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: none; } }
    @keyframes gp-pulse { 0%,100% { box-shadow: 0 0 0 6px rgba(230,197,116,0.28); } 50% { box-shadow: 0 0 0 16px rgba(230,197,116,0); } }
    .gp-stage { animation: gp-in 0.6s ease-out both; }
    .gp-pin-dot { animation: gp-pulse 1.8s infinite; }
    .gp-pin:hover .gp-pin-dot { background: #f7e2a4; }
    .gp-pin:focus-visible { outline: 3px solid #e6c574; outline-offset: 6px; border-radius: 12px; }
    @media (prefers-reduced-motion: reduce) {
      .gp-stage { animation: none; } .gp-pin-dot { animation: none; }
    }
  `;

  return (
    <div
      aria-label="전체 지도에서 갈 지역을 고르는 화면"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 18,
        background: "radial-gradient(120% 100% at 50% 35%, #171b22 0%, #0e1116 60%, #0a0c10 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden"
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: styleText }} />

      <div
        className="gp-stage"
        style={{ position: "relative", height: "88%", aspectRatio: "512 / 767", maxWidth: "94%" }}
      >
        <img
          src={MAP_URL}
          alt="대동여지도 전체 지도"
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />

        {/* 현재 위치(한양) — 참고용 표식 */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: `${HANYANG.x * 100}%`,
            top: `${HANYANG.y * 100}%`,
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            pointerEvents: "none"
          }}
        >
          <span
            style={{
              display: "block",
              width: 12,
              height: 12,
              margin: "0 auto",
              borderRadius: "50%",
              background: "#f2ece0",
              border: "2px solid rgba(0,0,0,0.5)"
            }}
          />
          <span
            style={{
              display: "inline-block",
              marginTop: 4,
              padding: "2px 8px",
              borderRadius: 12,
              background: "rgba(10,12,16,0.8)",
              color: "#c8ccd4",
              font: "400 11px/1.2 'Batang','바탕',serif",
              whiteSpace: "nowrap"
            }}
          >
            한양 · 지금 여기
          </span>
        </div>

        {/* 목적지(강릉) — 클릭 가능한 핀 */}
        <button
          type="button"
          className="gp-pin"
          onClick={onPick}
          aria-label="강릉을 선택해 그 길을 따라가기"
          style={{
            position: "absolute",
            left: `${GANGNEUNG.x * 100}%`,
            top: `${GANGNEUNG.y * 100}%`,
            transform: "translate(-50%, -50%)",
            appearance: "none",
            border: "none",
            background: "transparent",
            padding: 0,
            cursor: "pointer",
            textAlign: "center"
          }}
        >
          <span
            className="gp-pin-dot"
            style={{
              display: "block",
              width: 20,
              height: 20,
              margin: "0 auto",
              borderRadius: "50%",
              background: "#e6c574",
              border: "2px solid #fff",
              transition: "background 0.2s"
            }}
          />
          <span
            style={{
              display: "inline-block",
              marginTop: 7,
              padding: "4px 12px",
              borderRadius: 16,
              background: "rgba(10,12,16,0.86)",
              border: "1px solid rgba(230,197,116,0.6)",
              color: "#f2ece0",
              font: "600 clamp(12px, 1.3vw, 16px)/1.2 'Batang','바탕',serif",
              whiteSpace: "nowrap"
            }}
          >
            강릉 江陵
          </span>
        </button>
      </div>

      <p
        style={{
          position: "absolute",
          left: "50%",
          bottom: "4%",
          transform: "translateX(-50%)",
          margin: 0,
          padding: "10px 22px",
          borderRadius: 22,
          background: "rgba(10,12,16,0.72)",
          border: "1px solid #333a46",
          color: "#c8ccd4",
          font: "400 clamp(13px, 1.4vw, 16px)/1.3 'Malgun Gothic',sans-serif",
          whiteSpace: "nowrap"
        }}
      >
        어느 지역으로 가볼까요? — 지도에서 <strong style={{ color: "#e6c574" }}>강릉</strong>을 선택하세요
      </p>
    </div>
  );
}
