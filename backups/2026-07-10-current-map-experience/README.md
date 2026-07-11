# 기존 대동여지도 체험 화면 백업

서비스형 화면으로 전환하기 직전인 2026-07-10 상태를 보존한 백업입니다.

- `src/`: 당시 React 화면과 스타일 전체
- `public/assets/`: 화면 재생에 필요한 17개 이미지 자산
- `package.json`, `package-lock.json`, `tsconfig.json`, `index.html`: 당시 실행 환경

기존 화면은 새 코드에서도 `?legacy=1` 쿼리로 계속 확인할 수 있도록 유지합니다.

