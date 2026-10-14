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

## Cloudflare 배포 (Workers 정적 사이트)

2026-10-12: Cloudflare Pages가 Workers로 합쳐져(wrangler 4.149가 `pages project create`를 Workers로 넘김) Workers 정적 사이트로 올린다. 주소 **https://app.trovapp.workers.dev** (계정 workers.dev 이름 `trovapp` — `trova`는 이미 쓰임). 설정은 `wrangler.jsonc`.

```bash
npm run build:web && npx wrangler@4 deploy
```

- 카카오 지도: 카카오 디벨로퍼스 → 앱 → [플랫폼 키] → [JavaScript 키] → [JavaScript SDK 도메인]에 `https://app.trovapp.workers.dev` 등록(2026-10-12, 2025년 메뉴 개편 전의 '플랫폼 → Web → 사이트 도메인'). 등록 뒤 운영 도메인에서 지도 표시·장소 검색 200 확인.
- 처음 배포 때 Cloudflare 계정 이메일 인증이 필요했다(code 10034). 인증 뒤에도 인증 전에 받은 로그인 토큰으로는 계속 실패해 `wrangler logout` → `login`으로 다시 받아야 했다.

### (예전 기록) Cloudflare Pages

- 빌드 명령 `npm run build:web`, 출력 폴더 `dist`
- 환경 변수: `EXPO_PUBLIC_API_BASE_URL=https://<운영 백엔드>`(https가 아니면 빌드 실패), `EXPO_PUBLIC_KAKAO_MAP_JS_KEY`
- `dist/_headers`가 보안 헤더(CSP 해시 방식, `frame-ancestors 'none'` 등)를 건다. `404.html`이 없어 Pages가 모든 경로에 `index.html`을 준다(SPA).
- 배포 뒤:
  - 백엔드 운영 설정 `APP_WEB_APP_URL=https://<프로젝트>.pages.dev`
  - 카카오 개발자 콘솔 → 앱 → 플랫폼 → Web에 `https://<프로젝트>.pages.dev` 등록(지도)

## 아이폰 단축어 "Trova에 저장" (파일로 만들어 배포)

단축어 파일은 `scripts/build-shortcut.py`로 만들고 macOS `shortcuts sign`으로 서명해 `public/shortcut/`에 둔다. 앱의 마이페이지 → 아이폰 공유 단축어 → **단축어 받기**가 이 파일을 받는다(`src/lib/web/shortcut.ts`).

```bash
python3 scripts/build-shortcut.py https://<운영 백엔드> /tmp/raw.shortcut
shortcuts sign --mode anyone --input /tmp/raw.shortcut --output "public/shortcut/Trova에 저장.shortcut"
# 파일 이름을 NFC로 — macOS가 한글 이름을 NFD(자모 분리)로 만들면 Cloudflare 주소가 달라져 404(앱 화면 HTML)가 온다
python3 -c "import os,unicodedata as u;d='public/shortcut';[os.rename(f'{d}/{f}',f'{d}/{u.normalize(\"NFC\",f)}') for f in os.listdir(d) if u.normalize('NFC',f)!=f]"
```

- 백엔드 주소가 바뀌면 다시 만든다. 파일 이름이 단축어 이름이 된다.
- 키는 파일에 넣지 않는다. 가져올 때 "가져오기 질문"으로 사용자가 붙여넣는다.
- 동작: 공유 시트 입력 → URL 꺼내기 → 첫 번째 항목 → 키(텍스트) → `POST /api/shares`(헤더 `X-Trova-Share-Key`, JSON `url`) → 응답에 `jobId`가 있으면 성공 알림, 없으면 실패 알림.
- 첫 동작(입력에서 URL 가져오기)의 입력은 글자 칸이라 "단축어 입력"을 글 안 변수(텍스트 토큰)로 넣어야 한다. 변수 연결로 넣으면 iOS 26에서 입력이 비어 서버에 `url=`(빈 값)이 갔다(2026-10-12 시뮬레이터, 서버 로그로 확인).
- iCloud 링크가 아니면 `shortcuts://import-shortcut?url=`는 거부된다("제공된 단축어 URL이 유효하지 않습니다"). 그래서 Safari에서 파일을 받아 다운로드 목록에서 연다. 홈 화면 앱(standalone)에는 다운로드 목록이 없어 `x-safari-https://`로 Safari에 넘긴다(iOS 17+).
- 받는 방법 안내는 실제 화면 캡처(`public/install/sc-*.jpg`, iOS 26·iPhone 17 Pro 시뮬레이터)로 `src/components/ShortcutGuide.web.tsx`에 있다. 키가 보이는 화면은 쓰지 않는다. iOS 화면이 바뀌면 다시 찍는다.

키 규칙(백엔드 #165): 키로는 공유 저장만 된다, 키당 분당 10회 + 하루 공유 한도, 다시 받으면 이전 키는 바로 무효.
