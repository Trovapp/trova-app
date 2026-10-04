// 누르는 영역을 애플 권장 최소 크기(44pt)로 맞추는 hitSlop 계산(디자인 QA T).
// 보이는 크기(아이콘이나 버튼의 가로·세로)를 넣으면 모자라는 만큼만 바깥 여유를 준다. 예전엔 화면마다 6~13을 감으로 적어
// 아이콘 버튼 10곳과 글자 링크 5곳이 24~42pt였다. 옆 버튼과 붙어 있으면 maxHorizontal로 가로 여유를 간격의 절반까지만 준다.
export const MIN_TOUCH = 44;

export function hitSlopFor(width: number, height: number = width, maxHorizontal?: number) {
  const need = (size: number) => Math.max(0, Math.ceil((MIN_TOUCH - size) / 2));
  const h = maxHorizontal === undefined ? need(width) : Math.min(need(width), maxHorizontal);
  const v = need(height);
  return { top: v, bottom: v, left: h, right: h };
}
