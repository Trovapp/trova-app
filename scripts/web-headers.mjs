// 웹(PWA) 빌드(dist/) 뒤에 Cloudflare Pages용 dist/_headers를 만든다(ADR 0013).
// 지도 iframe(srcdoc)은 부모 페이지의 CSP를 물려받아, 지도 HTML의 인라인 스크립트 해시도 함께 넣는다.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildWebKakaoMapHtml } from "../src/lib/kakaoMapHtml.ts";
import { buildHeaders, inlineHandlerHashes, inlineScriptHashes, resolveApiOrigin } from "./web-csp.mjs";

const OUT = "dist";

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith(".html") ? [path] : [];
  });
}

try {
  // expo export와 같은 규칙으로 .env 파일을 읽는다.
  const { load } = await import("@expo/env");
  load(process.cwd());
  // 지도 키는 script 태그의 src(주소)에만 들어가 해시에 영향이 없다 — 아무 값으로 만든다.
  const mapHtml = buildWebKakaoMapHtml("KEY");
  const pages = htmlFiles(OUT).map((file) => readFileSync(file, "utf8"));
  const scriptHashes = inlineScriptHashes([...pages, mapHtml]);
  const handlerHashes = inlineHandlerHashes([mapHtml]);
  const apiOrigin = resolveApiOrigin(process.env.EXPO_PUBLIC_API_BASE_URL);
  writeFileSync(join(OUT, "_headers"), buildHeaders({ scriptHashes, handlerHashes, apiOrigin }));
  console.log(`[web-headers] dist/_headers 작성: 스크립트 해시 ${scriptHashes.size}개, 처리기 해시 ${handlerHashes.size}개, API ${apiOrigin}`);
} catch (error) {
  console.error(`[web-headers] ${error.message}`);
  process.exit(1);
}
