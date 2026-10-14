// 웹(PWA) 보안 헤더를 만드는 순수 함수들(ADR 0013) — web-headers.mjs(빌드)와 web-csp.test.mjs(node --test)가 쓴다.
// 관리자 웹(trova-frontend admin-web/scripts/csp.mjs)과 같은 방식: 'unsafe-inline' 대신 인라인 스크립트 해시만 허용한다.
import { createHash } from "node:crypto";

export const MAX_HEADER_LENGTH = 2000; // Cloudflare Pages _headers 한 줄 한도
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
// 카카오맵 SDK(지도 iframe 안에서 불러옴)와 지도 타일·이미지가 오는 곳. SDK가 t1.kakaocdn.net에서 본체를 더 불러온다.
// 스킴을 적지 않아 페이지와 같은 스킴만 허용된다(운영 https, 로컬 확인 http).
const KAKAO_SCRIPT_HOSTS = ["dapi.kakao.com", "t1.daumcdn.net", "*.kakaocdn.net"];
const KAKAO_CONNECT_HOSTS = ["*.kakao.com", "*.daumcdn.net", "*.kakaocdn.net"];

const sha = (text) => `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;

/** src가 없는 인라인 <script>의 해시. 빈 스크립트는 뺀다. */
export function inlineScriptHashes(htmlList) {
  const hashes = new Set();
  for (const html of htmlList) {
    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
      if (m[1].length > 0) hashes.add(sha(m[1]));
    }
  }
  return hashes;
}

/** onerror="…" 같은 인라인 이벤트 처리기의 해시('unsafe-hashes'와 함께 써야 허용된다). */
export function inlineHandlerHashes(htmlList) {
  const hashes = new Set();
  for (const html of htmlList) {
    for (const m of html.matchAll(/\son[a-z]+="([^"]*)"/g)) hashes.add(sha(m[1]));
  }
  return hashes;
}

/** 백엔드 출처 — 없거나 localhost가 아닌 http면 실패(운영 빌드가 조용히 localhost를 부르거나 토큰이 평문으로 오가지 않게). */
export function resolveApiOrigin(apiBase) {
  if (!apiBase) throw new Error("EXPO_PUBLIC_API_BASE_URL이 없습니다 — 운영은 https://<백엔드>");
  const url = new URL(apiBase);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname))) {
    throw new Error(`EXPO_PUBLIC_API_BASE_URL은 https여야 합니다(로컬만 http 허용): ${url.origin}`);
  }
  return url.origin;
}

export function buildHeaders({ scriptHashes, handlerHashes, apiOrigin }) {
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${KAKAO_SCRIPT_HOSTS.join(" ")} ${handlerHashes.size ? "'unsafe-hashes' " : ""}${[...scriptHashes, ...handlerHashes].sort().join(" ")}`,
    // react-native-web이 스타일을 직접 넣는다. 스크립트가 아니라 위험이 작아 허용한다.
    "style-src 'self' 'unsafe-inline'",
    // 프로필 사진·영상 썸네일·지도 타일은 여러 CDN에서 온다(https만).
    "img-src 'self' data: blob: https: *.kakaocdn.net *.daumcdn.net",
    "font-src 'self' data:",
    `connect-src 'self' ${apiOrigin} ${KAKAO_CONNECT_HOSTS.join(" ")}`,
    "frame-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ].join("; ");
  if (csp.length > MAX_HEADER_LENGTH) {
    throw new Error(`CSP가 ${csp.length}자라 Cloudflare 한도(${MAX_HEADER_LENGTH}자)를 넘습니다.`);
  }
  return [
    "/*",
    `  Content-Security-Policy: ${csp}`,
    // 공유·로그인 링크를 연 뒤 이전 주소(1회용 코드 등)가 다른 곳으로 새지 않게.
    "  Referrer-Policy: no-referrer",
    "  X-Content-Type-Options: nosniff",
    "  Permissions-Policy: camera=(), microphone=(), geolocation=()",
    "/sw.js",
    // 서비스 워커는 항상 새로 받는다 — 새 버전이 바로 반영되게.
    "  Cache-Control: no-cache",
    "",
  ].join("\n");
}
