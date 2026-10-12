// Trova PWA 서비스 워커(ADR 0013). 설치 조건만 맞추고 아무것도 캐시하지 않는다 —
// 캐시가 새 버전 반영을 막는 문제를 피하려고(Expo PWA 문서 경고). 오프라인 지원은 하지 않는다.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // 브라우저 기본 네트워크 요청 그대로.
});
