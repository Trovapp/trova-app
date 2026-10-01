// 화면 코드에 글자 크기·간격·모서리를 숫자로 직접 적었는지 검사한다(디자인 토큰 정리).
// 값은 src/lib/theme.ts의 fontSize·space·radius 토큰으로 써야 한다. 0은 허용한다.
// 정말 단계 밖 값이 필요하면 같은 줄에 "토큰 예외" 주석과 이유를 적는다.
// 사용: node scripts/check-design-tokens.mjs [검사할 경로...]   (기본: src 전체)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const PROPS = [
  "fontSize",
  "borderRadius", "borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius",
  "padding", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight", "paddingHorizontal", "paddingVertical",
  "margin", "marginTop", "marginBottom", "marginLeft", "marginRight", "marginHorizontal", "marginVertical",
  "gap", "rowGap", "columnGap",
];
const PATTERN = new RegExp(`\\b(${PROPS.join("|")}):\\s*(-?\\d+(?:\\.\\d+)?)\\b`, "g");
const SKIP = new Set(["src/lib/theme.ts"]);

function walk(path, out) {
  if (statSync(path).isDirectory()) {
    for (const name of readdirSync(path)) walk(join(path, name), out);
  } else if (/\.(tsx?|jsx?)$/.test(path) && !SKIP.has(path)) {
    out.push(path);
  }
  return out;
}

const roots = process.argv.slice(2);
const files = (roots.length ? roots : ["src"]).flatMap((r) => walk(r, []));
const problems = [];
for (const file of files) {
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    if (line.includes("토큰 예외")) return;
    for (const m of line.matchAll(PATTERN)) {
      if (Number(m[2]) === 0) continue;
      problems.push(`${file}:${i + 1}  ${m[1]}: ${m[2]}`);
    }
  });
}
if (problems.length) {
  console.log(problems.join("\n"));
  console.log(`\n숫자로 직접 적은 값 ${problems.length}곳 — theme.ts 토큰(fontSize/space/radius)으로 바꿔주세요.`);
  process.exit(1);
}
console.log(`디자인 토큰 검사 통과 (${files.length}개 파일)`);
