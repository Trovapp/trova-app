// 아이폰 단축어 "Trova에 저장" 파일(ADR 0013). scripts/build-shortcut.py로 만들어 public/shortcut/에 둔다(docs/pwa.md).
// iCloud 링크가 아니면 단축어 앱이 URL로 바로 가져오지 못해(import-shortcut 거부), Safari에서 파일을 받아 다운로드 목록에서 연다.
export const SHORTCUT_PATH = `/shortcut/${encodeURIComponent("Trova에 저장")}.shortcut`;

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** 단축어 파일 받기. 홈 화면 앱(standalone)에는 다운로드 목록이 없어 Safari로 넘겨 받는다(x-safari-https, iOS 17+). */
export function downloadShortcut(): void {
  const url = `${window.location.origin}${SHORTCUT_PATH}`;
  window.location.href = isStandalone() ? `x-safari-${url}` : url;
}
