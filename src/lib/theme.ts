// trova-frontend/src/app/globals.css의 실제 디자인 토큰을 그대로 이식한 값.
// 임의로 고른 색이 아니라 웹과 완전히 동일한 값이어야 한다 — 새 색을
// 추가하고 싶으면 먼저 웹 쪽 globals.css를 함께 바꿔야 한다.
const lightColors = {
  bg: "#ffffff",
  bgMuted: "#F7F7F5",
  border: "#DEDED8",
  borderSubtle: "#EDEDE8",
  ink: "#16211D",
  inkMuted: "#5F5E5A",
  accent: "#E14A2B",
  accentBg: "#FCECE6",
  // accent 배경(버튼 등) 위에 얹는 흰 글씨/아이콘 — 여기저기 "#fff"로 흩어져
  // 있던 걸 토큰 하나로 모음(시각적 변화 없음, 값은 동일).
  onAccent: "#ffffff",
  // 진한 글자색(ink)을 배경으로 쓰는 선택된 칩 위의 글자 — 다크에서는 ink가 밝아지므로 반대로 어둡게.
  onInk: "#ffffff",
  // 영상·휴대폰 그림처럼 모드와 상관없이 늘 어두운 면(온보딩 그림).
  media: "#16211D",
  kakao: "#FEE500",
};

// 다크 모드(페르소나 QA 2026-10-08: 시스템을 다크로 바꿔도 밝은 화면 그대로였다). 웹에는 아직 다크 토큰이 없어
// 앱에서 먼저 정한 값 — 같은 이름의 역할(배경·글자·강조)을 그대로 유지하고 대비(본문 글자/배경 ≥ 7:1)를 맞췄다.
const darkColors: typeof lightColors = {
  bg: "#1B1F1E",
  bgMuted: "#121514",
  border: "#343A38",
  borderSubtle: "#272C2A",
  ink: "#ECEBE6",
  inkMuted: "#A9A8A2",
  accent: "#F0603F",
  accentBg: "#3B241E",
  onAccent: "#ffffff",
  onInk: "#16211D",
  media: "#16211D",
  kakao: "#FEE500",
};

export type ColorScheme = "light" | "dark";
let currentScheme: ColorScheme = "light";
// App 루트가 시스템 화면 모드를 읽어 바꾼다. 색은 렌더할 때마다 읽으므로(스타일을 모듈에서 미리 만들지 않음)
// 루트가 모드 변경 때 화면을 새로 그리면 모든 화면이 따라 바뀐다.
export function setColorScheme(scheme: ColorScheme) {
  currentScheme = scheme;
}
export function getColorScheme(): ColorScheme {
  return currentScheme;
}

export const colors = Object.defineProperties(
  {} as { readonly [K in keyof typeof lightColors]: string },
  Object.fromEntries(
    (Object.keys(lightColors) as (keyof typeof lightColors)[]).map((key) => [
      key,
      { enumerable: true, get: () => (currentScheme === "dark" ? darkColors : lightColors)[key] },
    ]),
  ),
);

// 글자 크기 단계 — iOS 기본 글자 단계(Dynamic Type의 기본 크기)를 따른다. 예전엔 화면마다 11~48 사이 11가지
// 숫자를 직접 골라 썼다. 단계에 없던 값은 가까운 단계로 옮겼다: 14→15, 18→17, 26→28, 32→34.
// 웹(Tailwind 12/14/16…)과는 단계가 다르다 — 앱에서 가장 많이 쓰던 13을 남기려고 iOS 단계를 골랐다.
export const fontSize = {
  caption2: 11,
  caption1: 12,
  footnote: 13,
  subheadline: 15,
  callout: 16,
  body: 17,
  title3: 20,
  title2: 22,
  title1: 28,
  largeTitle: 34,
  // 분석 진행 카드의 큰 숫자 한 곳에만 쓰는 예외 크기(단계 밖).
  hero: 48,
} as const;

// 간격 — 4의 배수를 기본으로 한다. 예전의 6·10·14·18은 위 단계로 올렸다(6→8, 10→12, 14→16, 18→20).
// xxxs(2)만 예외 — 제목과 부제 사이, 아이콘과 글자 사이처럼 눈으로 맞추는 아주 좁은 간격에 쓴다.
export const space = {
  xxxs: 2,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

// 모서리 — 웹의 rounded-lg(8)·xl(12)·2xl(16)·full과 같은 단계. 예전 10·14는 12로 모았고,
// 점(지름의 절반)과 알약 모양 버튼(20)은 full로 바꿨다(모양은 그대로).
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
} as const;

// 움직임 시간(ms) — 화면마다 숫자를 직접 적어 목록이 하나씩 나타나는 간격이 60·70·220ms로 제각각이었다(디자인 QA M3).
// 값은 예전 그대로 옮겼고, 목록 등장 간격만 60으로 맞췄다(영상 속 장소 70 → 60). 온보딩 그림처럼 장면마다 맞춘 연출 타이밍은 각 파일에 둔다.
export const motion = {
  press: 150, // 누름 반응(expo-animation 스킬 기준 100~150)
  base: 250, // 화면·요소 페이드
  slow: 400, // 진행 막대 같은 큰 변화
  enter: 500, // 첫 화면 제목처럼 천천히 나타나는 요소
  shimmer: 700, // 스켈레톤 반짝임 한 번
  listDelay: 250, // 목록이 나타나기 시작할 때까지
  listStagger: 60, // 목록 항목 사이 간격
  reveal: 420, // 분석 중 찾은 장소 이름이 하나씩 나타날 때 한 개의 시간
  revealStagger: 220, // 그 이름들 사이 간격 — 결과를 기다리는 화면이라 일부러 느리게
} as const;
