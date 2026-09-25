// 12345 → "12,345". 기기 로캘/Intl 지원 여부와 무관하게 항상 같은 결과를 내도록 직접 포맷한다.
export function formatCount(value: number): string {
  return String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
