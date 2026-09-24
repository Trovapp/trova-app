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
