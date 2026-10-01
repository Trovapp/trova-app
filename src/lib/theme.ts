// trova-frontend/src/app/globals.css의 실제 디자인 토큰을 그대로 이식한 값.
// 임의로 고른 색이 아니라 웹과 완전히 동일한 값이어야 한다 — 새 색을
// 추가하고 싶으면 먼저 웹 쪽 globals.css를 함께 바꿔야 한다.
export const colors = {
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
  kakao: "#FEE500",
} as const;

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
