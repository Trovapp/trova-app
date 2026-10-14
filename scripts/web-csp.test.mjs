import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildWebKakaoMapHtml, WEB_MAP_BRIDGE_SCRIPT } from "../src/lib/kakaoMapHtml.ts";
import { buildHeaders, inlineHandlerHashes, inlineScriptHashes, resolveApiOrigin } from "./web-csp.mjs";

const sha = (s) => `'sha256-${createHash("sha256").update(s, "utf8").digest("base64")}'`;

test("지도 HTML의 인라인 스크립트(웹 브리지 포함)와 onerror 처리기 해시를 모두 모은다", () => {
  const html = buildWebKakaoMapHtml("KEY");
  const scripts = inlineScriptHashes([html]);
  assert.ok(scripts.has(sha(WEB_MAP_BRIDGE_SCRIPT)));
  assert.ok(scripts.size >= 2, "브리지 + 지도 본문 스크립트");
  assert.equal(inlineHandlerHashes([html]).size, 1);
});

test("지도 키가 바뀌어도 해시는 같다(키는 script src 주소에만 들어간다)", () => {
  assert.deepEqual([...inlineScriptHashes([buildWebKakaoMapHtml("A")])], [...inlineScriptHashes([buildWebKakaoMapHtml("B")])]);
});

test("CSP는 unsafe-inline 스크립트 없이 해시·카카오 SDK·API 출처만 허용한다", () => {
  const headers = buildHeaders({ scriptHashes: new Set([sha("a")]), handlerHashes: new Set([sha("b")]), apiOrigin: "https://api.example.com" });
  const csp = headers.split("\n").find((l) => l.includes("Content-Security-Policy"));
  assert.ok(!/script-src[^;]*'unsafe-inline'/.test(csp));
  assert.ok(csp.includes("'unsafe-hashes'"));
  assert.ok(csp.includes(sha("a")) && csp.includes(sha("b")));
  assert.ok(csp.includes("dapi.kakao.com") && csp.includes("*.kakaocdn.net"));
  assert.ok(csp.includes("connect-src 'self' https://api.example.com"));
  assert.ok(headers.includes("frame-ancestors 'none'"));
});

test("API 주소가 없거나 localhost가 아닌 http면 실패한다", () => {
  assert.throws(() => resolveApiOrigin(undefined));
  assert.throws(() => resolveApiOrigin("http://api.example.com"), /https/);
  assert.equal(resolveApiOrigin("https://api.example.com/x"), "https://api.example.com");
  assert.equal(resolveApiOrigin("http://localhost:8081"), "http://localhost:8081");
});
