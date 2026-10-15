// 분석 화면이 결과 화면으로 넘어가도 되는지. 알림·공유로 다른 화면이 위에 올라온 뒤에도 뒤에 남은 분석 화면이
// 넘어가면 그 화면을 덮어 버렸다(안드로이드 QA 2026-10-15, #35) — 지금 보이는 화면일 때만 넘어간다.
export function shouldOpenResult(state: {
  isSuccess: boolean;
  isFetchedAfterMount: boolean;
  hasJob: boolean;
  retrying: boolean;
  focused: boolean;
}): boolean {
  return state.isSuccess && state.isFetchedAfterMount && !state.hasJob && !state.retrying && state.focused;
}
