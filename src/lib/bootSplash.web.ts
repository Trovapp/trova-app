// 웹(PWA) 시작 화면(public/index.html #boot-splash)을 흐리게 지운다. 로그인 확인이 끝났을 때(RootNavigator)와
// 설치 안내 화면을 보여 줄 때(WebEntryGate) 부른다. 여러 번 불러도 한 번만 지운다.
export function hideBootSplash(): void {
  const el = typeof document !== "undefined" ? document.getElementById("boot-splash") : null;
  if (!el || el.dataset.hiding === "1") return;
  el.dataset.hiding = "1";
  el.style.opacity = "0";
  window.setTimeout(() => el.remove(), 300);
}
