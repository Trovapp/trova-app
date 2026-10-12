# PWA(설치형 웹앱) — 실행·배포·단축어 만들기

결정: Trovapp/trova-backend `docs/adr/0013-pwa-before-app-store.md`, 설계: 같은 레포 `docs/superpowers/specs/2026-10-12-pwa-design.md`.

같은 앱 코드를 웹으로 내보내 PWA로 배포한다. 웹에서 안 되는 부분만 `*.web.ts(x)` 파일로 바꾼다.

| 부분 | 앱 | 웹 파일 |
|---|---|---|
| 토큰 저장 | expo-secure-store | `src/lib/tokenStorage.web.ts`(localStorage) |
| 로그인 | 딥링크 `mobile=true` | `client=web` → `/auth/callback/?code=` → `src/lib/auth/webLoginCallback.web.ts` |
| 공유 받기 | expo-share-intent | `src/components/ShareIntentListener.web.tsx`(안드로이드 `/share/?url=&text=`) |
| 붙여넣기 버튼 | iOS 네이티브 버튼 | `src/lib/clipboard.web.ts` |
| 지도 | WebView | `src/components/InlineMap.web.tsx`(iframe) |
| 확인 창(Alert) | 시스템 창 | `src/components/WebAlertHost.web.tsx` |
| 날짜·시간 선택 | datetimepicker | `src/lib/web/DateTimePicker.tsx`(metro.config.js가 웹에서만 바꿔 끼움) |
| 첫 화면 | — | `src/components/WebEntryGate.web.tsx`(소개 → 설치 안내, 홈 화면 앱이면 건너뜀) |

주의: 웹 파일 확장자는 원래 파일과 같아야 한다(`clipboard.ts` ↔ `clipboard.web.ts`). 다르면 Metro가 원래 파일을 먼저 골라 웹 파일이 무시된다.

## 로컬 실행

```bash
npm run web                       # 개발 서버
EXPO_PUBLIC_API_BASE_URL=http://localhost:8081 npm run build:web   # dist/ + dist/_headers
npm run test:web                  # 보안 헤더 스크립트 테스트(node --test)
```

백엔드는 `APP_WEB_APP_URL=http://localhost:<웹 포트>`로 띄운다(로그인 돌아올 주소·CORS).

`build:web`은 항상 캐시를 지우고(`--clear`) 빌드한다 — 캐시가 남으면 번들의 API 주소와 보안 헤더(CSP)의 주소가 어긋나 화면이 API를 못 부른다(2026-10-12 로컬 확인에서 겪음).

## Cloudflare Pages 배포

- 빌드 명령 `npm run build:web`, 출력 폴더 `dist`
- 환경 변수: `EXPO_PUBLIC_API_BASE_URL=https://<운영 백엔드>`(https가 아니면 빌드 실패), `EXPO_PUBLIC_KAKAO_MAP_JS_KEY`, `EXPO_PUBLIC_SHORTCUT_URL`(아래 단축어 iCloud 링크)
- `dist/_headers`가 보안 헤더(CSP 해시 방식, `frame-ancestors 'none'` 등)를 건다. `404.html`이 없어 Pages가 모든 경로에 `index.html`을 준다(SPA).
- 배포 뒤:
  - 백엔드 운영 설정 `APP_WEB_APP_URL=https://<프로젝트>.pages.dev`
  - 카카오 개발자 콘솔 → 앱 → 플랫폼 → Web에 `https://<프로젝트>.pages.dev` 등록(지도)

## 아이폰 단축어 "Trova에 저장" 만들기 (한 번, 아이폰에서)

단축어 파일은 애플 서명이 필요해 서버에서 만들지 않는다. 아이폰 단축어 앱에서 아래대로 만들고 iCloud 링크로 공유한 뒤, 그 링크를 `EXPO_PUBLIC_SHORTCUT_URL`에 넣는다.

1. 단축어 앱 → `+` → 이름 **Trova에 저장**
2. 설정(ⓘ) → **공유 시트에서 보기** 켜기, 받는 입력: **URL**, **텍스트**
3. 동작 추가
   1. **입력에서 URL 가져오기** (입력: 단축어 입력)
   2. **목록에서 항목 가져오기** — 첫 번째 항목
   3. **텍스트** — 내용은 비워 두고 이름을 `공유 키`로. 단축어 설정 → **가져오기 질문** 에 이 텍스트를 추가하고 질문을 "Trova 마이페이지 → 아이폰 공유 단축어에서 받은 키를 붙여넣어 주세요"로
   4. **URL 내용 가져오기**
      - URL: `https://<운영 백엔드>/api/shares`
      - 방법: POST
      - 헤더: `X-Trova-Share-Key` = `공유 키`, `Content-Type` = `application/json`
      - 요청 본문: JSON, `url` = 2번의 항목
   5. **만약** (4번 결과에 `jobId`가 있으면) → **알림 보기** "Trova에 보냈어요. 분석이 끝나면 앱에서 볼 수 있어요." / 아니면 → **알림 보기** "저장하지 못했어요. 키를 다시 받아 단축어에 넣어 주세요."
4. 공유(⤴) → **iCloud 링크 복사** — 공유하면 키 값은 빠지고 가져오기 질문만 남는다(키가 퍼지지 않음).

키 규칙(백엔드 #165): 키로는 공유 저장만 된다, 키당 분당 10회 + 하루 공유 한도, 다시 받으면 이전 키는 바로 무효.
