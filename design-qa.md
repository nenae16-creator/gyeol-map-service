# Design QA — GYEOL 서비스형 프로토타입

## Current QA — 첫 화면 대동여지도·배경 통합

- Source visual truth: `tmp/qa/opening-map-user-reference.png`
- Same-viewport baseline: `tmp/qa/service-idle-doseongdo-korean-final.png`
- Implementation URL: `http://127.0.0.1:5187/`
- Desktop viewport/state: `1487 × 1058`, 첫 화면
- Mobile viewport/state: `390 × 844`, 첫 화면
- Desktop implementation: `tmp/qa/service-idle-opening-map-integrated-final.png`
- Mobile implementation: `tmp/qa/service-mobile-idle-opening-map-integrated-final.png`
- Full-view comparison: `tmp/qa/opening-map-integration-comparison.png`
- Focused comparison: `tmp/qa/opening-map-integration-focus-comparison.png`
- Automated evidence: `tmp/qa/playwright-report-opening-map-integrated-final.json`

### Findings

최종 비교에서 수정이 필요한 P0/P1/P2 문제는 발견되지 않았습니다.

- [P3] 실제 대동여지도의 첩 경계는 여전히 보임
  - Location: 첫 화면 중앙 지도 외곽
  - Evidence: 수정 후 회백색과 평면적인 경계는 줄었지만 원본 판본의 직각 종이 조각은 남아 있음.
  - Impact: 배경 분리로 보일 정도의 색 차이는 없고, 대동여지도가 여러 첩으로 구성된 유물이라는 성격을 전달함.
  - Decision: 역사 자산의 형태를 임의로 지우지 않고 한지색 합성·먹선·접촉 그림자로 통합함.

### Full-View Comparison Evidence

- `tmp/qa/opening-map-integration-comparison.png`
- 수정 전의 차가운 회백색 지도와 수정 후의 따뜻한 한지·먹선 합성을 동일한 `1487 × 1058` 상태로 나란히 비교함.
- 지도는 `(498, 122, 526, 776)`으로 중앙 매트 안에 유지되며 검색, 질문 패널, 하단 단계와 겹치지 않음.
- 약한 `-0.2deg` 기울기와 지도 윤곽을 재사용한 접촉 그림자로 책상 위 실물 판본의 깊이를 추가함.

### Focused Region Comparison Evidence

- `tmp/qa/opening-map-integration-focus-comparison.png`
- 종이 첩의 명도와 색온도가 배경 한지에 가까워졌고, 아래 배경의 광원·결이 지도 위에 이어짐.
- 먹선은 이전보다 선명하게 유지하면서 종이 조각의 회백색 테두리는 약해짐.
- `tmp/qa/service-decoding-opening-map-integrated-final.png`
- 해독 단계에서는 지도가 `0deg`로 정렬되고 대비가 올라가 후보 마커와 지리 선이 읽힘.

### Required Fidelity Surfaces

- Fonts and typography: 지도 변경 범위 밖의 검색, 질문, 단계 타이포그래피와 줄바꿈을 그대로 유지함.
- Spacing and layout rhythm: 지도만 약 3% 확대하고 중앙 위치를 미세 조정함. 데스크톱과 모바일에서 overflow가 없음.
- Colors and visual tokens: 회청색 종이를 한지색·먹색·갈색 그림자 계열로 조정해 배경 매트와 같은 팔레트를 사용함.
- Image quality and asset fidelity: 기존 512×767 투명 대동여지도 자산을 그대로 사용함. 왜곡, 새 지리 생성, 잘못된 크롭이 없음.
- Copy and content: 지도 장식 변경으로 서비스 문구와 근거 상태는 변경하지 않음.
- Accessibility: 본 지도 alt는 유지하고, 접촉 그림자용 복제 이미지는 빈 alt와 `aria-hidden`으로 제외함. reduced-motion과 `prefers-contrast: more` 대체 표현을 제공함.

### Interaction Verification

- 검색 → 해독 → 결과 → 지도 여정 → 도착 → 결과 복귀: 통과
- 첫 화면/해독 중 지도 전환: 통과
- 데스크톱/모바일 첫 화면: 통과
- 키보드 순서와 결과 heading 초점: 통과
- 콘솔 오류/page error/failed request: 각 0
- 브라우저 요청의 API 키 노출: 없음

### Comparison History

1. 기존 화면
   - [P1] 지도 첩이 배경보다 밝고 차가워 별도 스캔 이미지처럼 보임.
   - [P2] 접촉 그림자가 약해 지도와 한지 매트 사이의 깊이가 없음.
2. `opening-map-integrated-v1`
   - 지도 본체에 한지색 곱하기 합성과 윤곽 기반 먹 그림자를 적용하고 크기·기울기를 조정함.
   - [P2] 모바일에서는 합성 후 먹선 대비가 충분하지 않음.
3. `opening-map-integrated-final`
   - 모바일 전용 대비와 불투명도를 높이고 합성 경계를 완화함.
   - 최종 캡처에서 겹침, overflow, 콘솔·네트워크 오류가 없음.

final result: passed

## Current QA — 도성도 한글 판독·한성부 스타일 통합

- Source visual truth: `public/assets/hansung-detail-map-base-v3.png`
- Geographic source truth: `public/assets/official/nmk-shinsu19997-doseongdo-original.jpg`
- Implementation URL: `http://127.0.0.1:5187/`
- Desktop viewport/state: `1487 × 1058`, 서울시청 여정 도착
- Mobile viewport/state: `390 × 844`, reduced-motion 도착
- Desktop implementation: `tmp/qa/service-journey-arrived-doseongdo-korean-final.png`
- Mobile implementation: `tmp/qa/service-mobile-journey-arrived-doseongdo-korean-final.png`
- Full/focused comparison: `tmp/qa/doseongdo-korean-final-comparison.png`
- Automated evidence: `tmp/qa/playwright-report-doseongdo-korean-final.json`

### Findings

최종 비교에서 수정이 필요한 P0/P1/P2 문제는 발견되지 않았습니다.

- [P3] 공식 도성도의 가로 비율이 기존 한성부 해설 지도의 세로 비율과 다름
  - Location: 여정 우측 상세 지도
  - Evidence: 기존 시안은 세로형 해설 그림이고 공식 원본은 도성 내부를 담은 가로형 판본임.
  - Impact: 구성 비율은 다르지만 실제 도상 좌표와 길의 도착점을 보존하려면 공식 비율 유지가 필요함.
  - Decision: 직접 중첩하거나 세로로 왜곡하지 않고, 종이색·청록 테두리·먹선 대비·한글 명패로 스타일만 통일함.

### Full-View Comparison Evidence

- `tmp/qa/service-journey-arrived-doseongdo-korean-final.png`
- 공식 도성도는 우측 `(약 659, 152, 800, 603)`에 유지되고 접이 지도와 길이 앞쪽에서 자연스럽게 겹침.
- 회백색 사진처럼 보이던 원본을 세피아·저채도·곱하기 혼합으로 조정하고, 기존 한성부 지도의 짙은 청록 이중 테두리와 종이 그림자를 적용함.
- 한글 판독 명패 11개와 선택 지점 `서울시청`이 원본 도상 위 별도 레이어로 표시됨.

### Focused Region Comparison Evidence

- `tmp/qa/doseongdo-korean-final-comparison.png`
- 기존 한성부 지도와 최종 도성도를 한 화면에서 비교해 종이색, 산의 녹색 밀도, 먹선 대비, 테두리, 제목 명패를 확인함.
- 공식 지도의 실제 지리와 판본 비율을 보존하기 때문에 형태 차이는 의도된 제약으로 분류함.
- `tmp/qa/service-mobile-journey-arrived-doseongdo-korean-final.png`
- 도착 후 도성도가 화면 너비 `359px(92%)`로 확대되고 경복궁·광화문·창덕궁·종묘 및 선택 지점이 읽힘.
- 한글 판독 설명과 다시 보기 버튼이 겹치지 않음.

### Required Fidelity Surfaces

- Fonts and typography: 제목과 지명은 기존 명조 계열을 유지하고 한글 지명은 데스크톱 `9–11px`, 확대된 모바일 `10–12px`로 표시함. 한자 제목은 제거함.
- Spacing and layout rhythm: 데스크톱의 접이 지도·길·우측 상세 지도 순서를 유지함. 모바일 도착 상태만 우측 지도를 92%로 확대해 판독성을 우선함.
- Colors and visual tokens: 한지색, 먹색, 인주색, 낮은 채도의 녹색과 청록 테두리를 기존 한성부 시안에 맞춤.
- Image quality and asset fidelity: 3000×1825 공식 원본과 기존 좌표 체계를 유지함. 이미지 비율 왜곡, 가짜 지리 중첩, 저해상도 대체가 없음.
- Copy and content: `한성부 / 도성도 한글 판독`, 11개 한글 지명, `서울시청 일대는 현대 위치 추정` 안내로 원본 판독과 추정을 분리함.
- Accessibility: 상세 지도를 `figure/figcaption`으로 구조화하고 제목·설명을 연결함. 선택 지점은 `aria-current="location"`, 지명 목록은 한국어 접근성 이름을 제공함. reduced-motion에서 즉시 도착 상태가 표시됨.

### Interaction Verification

- 검색 → 해독 → 근거 결과 → 지도 여정 → 도착 → 근거 결과 복귀: 통과
- 공식 도성도 자산과 벡터 길: 통과
- 한글 지명 11개와 선택 지점: 통과
- 데스크톱/모바일 도착 화면: 통과
- 모바일 판독 설명과 다시 보기 버튼 비중첩: 통과
- 국립중앙박물관 출처·공공누리 링크: 통과
- 콘솔 오류/page error/failed request: 각 0
- 브라우저 요청의 API 키 노출: 없음

### Comparison History

1. `doseongdo-korean-v1`
   - [P1] 공식 지도와 기존 한성부 시안의 종이색·테두리·명패 스타일이 분리되어 보임.
   - [P1] 한문 원본만 보여 주요 지명을 빠르게 읽기 어려움.
   - Fix: 공식 원본 보존, 세피아·저채도·먹선 대비·이중 테두리 적용, 한글 지명 11개 추가.
2. `doseongdo-korean-v2`
   - [P2] 모바일 도착 지도는 확대됐지만 하단 판독 설명이 다시 보기 버튼과 겹침.
   - Fix: 설명 폭을 68%로 줄여 좌측에 고정하고 모바일 핵심 지명만 표시.
3. `doseongdo-korean-final`
   - 후속 캡처에서 데스크톱과 모바일의 지명, 설명, 선택 지점, 출처, 버튼 비중첩을 확인함.
   - 모든 주요 진단과 네트워크 검사가 통과함.

final result: passed

## Comparison Target

- Source visual truth: `tmp/idle-photo-background-preview-v2.png`
- Implementation URL: `http://127.0.0.1:5187/`
- Legacy URL: `http://127.0.0.1:5187/?legacy=1`
- Desktop viewport: `1487 × 1058`
- Mobile viewport: `390 × 844`
- Final implementation screenshots:
  - `tmp/qa/service-idle-v4.png`
  - `tmp/qa/service-decoding-v4.png`
  - `tmp/qa/service-result-v4.png`
  - `tmp/qa/service-mobile-idle-v4.png`
  - `tmp/qa/service-mobile-result-v4.png`
  - `tmp/qa/service-journey-v4.png`
  - `tmp/qa/service-journey-arrived-v4.png`
  - `tmp/qa/service-unsupported-v4.png`
  - `tmp/qa/service-location-denied-v4.png`
- Automated evidence: `tmp/qa/playwright-report-v4.json`

## Findings

최종 비교에서 수정이 필요한 P0/P1/P2 문제는 발견되지 않았습니다.

- [P3] 데스크톱 결과 패널 하단에 넉넉한 여백이 남음
  - Location: 결과 화면 우측 패널
  - Evidence: 근거 카드는 상단에 모이고 주 행동은 하단에 고정되어 중간에 여백이 생김.
  - Impact: 기능이나 가독성을 방해하지 않으며 박물관 해설지의 절제된 구도를 유지함.
  - Follow-up: 실제 근거 레코드가 늘어나면 여백이 자연스럽게 채워지므로 현재는 유지.

## Full-View Comparison Evidence

- `tmp/qa/service-idle-reference-comparison-v4.png`
- 기존 중앙 대동여지도 `512×767`의 위치 `(510,127)`과 사진형 한지·목재·소품 구도를 유지함.
- 기존 고정 검색·하단 단계가 있던 영역은 실제 입력과 4단계 서비스 상태로 교체됨.
- 오른쪽 빈 작업 공간에는 동일한 한지색·얕은 테두리·낮은 그림자를 사용한 질문 패널을 추가함.
- 데스크톱 문서 크기는 viewport와 동일한 `1487×1058`이며 수평·수직 overflow가 없음.

## Focused Region Comparison Evidence

- `tmp/qa/service-right-panel-comparison-v4.png`
- 기준 화면의 우측 한지·고서·먹물 소품 위에 서비스 패널을 놓되 사진 배경이 약하게 비치도록 처리해 별도 웹 카드처럼 뜨는 느낌을 줄임.
- `tmp/qa/service-mobile-result-fix-comparison-v4.png`
- 첫 비교에서 화면 아래에 있던 핵심 체험 버튼을 결과 패널에 고정하고 지도 높이를 줄여, 최종 비교에서는 근거와 주 행동이 첫 화면 안에 함께 보임.

## Required Fidelity Surfaces

- Fonts and typography: 외부 Google Fonts를 제거하고 `Noto Serif KR → Source Han Serif KR → Batang` 시스템 명조 fallback을 사용함. 제목·근거·보조문구의 무게와 줄바꿈이 데스크톱/모바일에서 안정적임.
- Spacing and layout rhythm: 초기 중앙 지도, 해독/결과의 `(272,148,450,674)` 좌측 지도와 `(770,154,460,692)` 우측 패널, `(0,949,1487,109)` 하단 진행 영역이 의도한 실측값과 일치함.
- Colors and visual tokens: 목재·한지·먹색·인주색을 유지하고 `판본에서 확인`, `공공데이터 확인`, `권역 대응 추정`을 색과 문구로 함께 구분함.
- Image quality and asset fidelity: 지도는 기존 실제 컷아웃을 그대로 사용하고, 사진 배경은 검색·진행 UI만 제거한 `gyeol-service-desk-plate.png`를 1487×1058로 사용함. 투명 외곽과 축척에 눈에 띄는 깨짐이 없음.
- Copy and content: 현재 위치→옛지명 후보→판본·공공데이터·추정→선택형 체험이라는 기획안의 핵심을 첫 흐름에서 이해할 수 있음. 지원 밖 위치에는 결과를 생성하지 않음.
- Icons: 기존 프로젝트의 Lucide 계열을 일관된 선 두께·크기로 사용하고 텍스트 라벨을 함께 제공함.
- Accessibility: search form과 label, 최소 42px 이상의 주요 버튼, 키보드 순서, 결과 heading 초점, live status/alert, reduced-motion, 색상 외 문구 구분을 확인함.

## Interaction Verification

Playwright CLI를 사용자 승인 후 실행했습니다.

- 검색 입력 → 해독 → 결과: 통과
- 해독 4단계 순차 상태: 통과
- 결과 heading 초점: `한양·한성부 권역 후보`로 이동 확인
- 근거 details 열기: 통과
- 국립중앙박물관 출처 URL: 정확한 링크 확인
- 지도 체험 자동 시작: 통과
- 이동 건너뛰기와 도착 화면: 통과
- 근거 결과로 복귀: 통과
- 다른 위치 찾기: 통과
- 미지원 `부산역` 안내: 통과
- 위치 권한 거부 안내: 통과
- `?legacy=1` 기존 화면: 통과
- 모바일 핵심 체험 버튼 노출: 통과
- 데스크톱 키보드 첫 순서: 검색 입력 → 해독 → 현재 위치 → 예시 해독 → 예시 장소
- 콘솔 오류: 0
- page error: 0
- failed request: 0

## Comparison History

1. v1
   - [P2] 결과 heading에 초점이 이동하지 않고 문서 body에 남음.
   - [P2] 모바일 결과에서 체험 버튼이 근거 목록 아래로 밀려 첫 화면에서 보이지 않음.
   - Evidence: `tmp/qa/service-mobile-result-v1.png`, `tmp/qa/playwright-report-v1.json`.
2. v2
   - 결과 상태가 렌더된 뒤 heading에 초점을 이동하는 effect를 추가함.
   - 결과 패널을 column layout으로 바꾸고 근거 목록만 스크롤되도록 하여 주 행동을 하단에 고정함.
   - Evidence: `tmp/qa/service-result-v2.png`, `tmp/qa/playwright-report-v2.json`.
3. v3
   - 모바일 결과의 지도 높이를 `270px → 219px`로 줄이고 패널을 `371px → 430px`로 확대해 근거와 행동 공간을 확보함.
   - 불필요한 프로그램 초점 테두리를 제거하되 heading 초점 자체는 유지함.
   - Evidence: `tmp/qa/service-mobile-result-fix-comparison-v4.png`, `tmp/qa/playwright-report-v3.json`.
4. v4
   - 키보드 순서, 근거 펼치기, 모바일 CTA, 위치 권한 거부 상태를 추가 검증함.
   - 모든 주요 viewport에서 overflow 없음. 콘솔·페이지·네트워크 오류 없음.
   - Evidence: `tmp/qa/playwright-report-v4.json`.

## Implementation Checklist

- [x] 기존 화면 소스·설정·17개 사용 자산 백업
- [x] 기본 서비스와 `?legacy=1` 분리
- [x] 장소 검색·현재 위치·미지원/권한 거부 상태
- [x] 옛지명 해독 4단계와 근거형 결과
- [x] 결과 이후 기존 지도 체험 연결
- [x] 외부 웹폰트 의존 제거
- [x] 데스크톱·모바일 실제 렌더 캡처
- [x] 기준 이미지와 full/focused side-by-side 비교
- [x] 키보드·초점·주요 클릭·콘솔·네트워크 검증
- [x] 타입검사·프로덕션 빌드

final result: passed
