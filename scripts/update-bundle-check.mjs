// 무선 업데이트를 올리기 전에 번들 안의 서버 주소를 검사한다(#33).
// eas update는 eas.json의 env를 쓰지 않아, 운영 채널에 로컬 주소가 들어간 채 나갈 수 있다(2026-10-15 PWA에서 실제로 겪음).
// 사용: node scripts/update-bundle-check.mjs <채널> <export 폴더>
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// https://localhost는 카카오 지도 웹뷰 기준 주소(InlineMap)라 막지 않는다 — 막을 건 로컬 API(http://localhost:8080).
const EXPECTED = {
  production: { must: "https://193-123-161-217.sslip.io", mustNot: ["http://localhost", "127.0.0.1"] },
  preview: { must: "http://localhost:8080", mustNot: [] },
};

export function bundleProblems(text, channel) {
  const rule = EXPECTED[channel];
  if (!rule) return [`모르는 채널: ${channel}`];
  const problems = [];
  if (!text.includes(rule.must)) problems.push(`${channel} 주소(${rule.must})가 번들에 없음`);
  for (const bad of rule.mustNot) {
    if (text.includes(bad)) problems.push(`${channel} 번들에 ${bad}가 들어 있음`);
  }
  return problems;
}

function bundleText(dir) {
  return readdirSync(dir)
    .map((name) => join(dir, name))
    .map((path) => (statSync(path).isDirectory() ? bundleText(path) : /\.(hbc|js)$/.test(path) ? readFileSync(path, "latin1") : ""))
    .join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [channel, dir] = process.argv.slice(2);
  const problems = bundleProblems(bundleText(join(dir, "_expo")), channel);
  if (problems.length > 0) {
    console.error("업데이트 중단:\n- " + problems.join("\n- "));
    process.exit(1);
  }
  console.log(`번들 주소 검사 통과(${channel})`);
}
