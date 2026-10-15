// 홈의 일정 초안 카드. 영상을 연달아 공유하면 카드가 영상마다 쌓여 홈을 밀어냈다(안드로이드 QA 2026-10-15, #35) —
// 누를 수 있는 준비된 것부터 2개만 보이고, 나머지는 "더 보기"로 펼친다.
export const DRAFT_CARD_LIMIT = 2;

export function visibleDrafts<T extends { status: string }>(drafts: T[], expanded: boolean): { shown: T[]; hiddenCount: number } {
  const ordered = [...drafts.filter((d) => d.status === "READY"), ...drafts.filter((d) => d.status !== "READY")];
  if (expanded || ordered.length <= DRAFT_CARD_LIMIT) return { shown: ordered, hiddenCount: 0 };
  return { shown: ordered.slice(0, DRAFT_CARD_LIMIT), hiddenCount: ordered.length - DRAFT_CARD_LIMIT };
}
