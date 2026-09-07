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
  kakao: "#FEE500",
} as const;
