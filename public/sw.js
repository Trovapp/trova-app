// Trova PWA 서비스 워커(ADR 0013). 설치 조건을 맞추고 웹 푸시(백엔드 #185, ADR 0016)를 표시·처리한다.
// 아무것도 캐시하지 않는다 — 캐시가 새 버전 반영을 막는 문제를 피하려고(Expo PWA 문서 경고). 오프라인 지원은 하지 않는다.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // 브라우저 기본 네트워크 요청 그대로.
});

// 서버는 { title, body, open, tag }를 보낸다. tag가 같으면 기기에서 하나로 바뀐다.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Trova";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || undefined,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { open: data.open || "" },
    }),
  );
});

// 누르면: 열린 Trova 창이 있으면 그 창에서 이동, 없으면 /?open= 으로 새로 연다(앱 시작 때 PushOpenListener가 읽는다).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const open = (event.notification.data && event.notification.data.open) || "";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const client = clients.find((c) => new URL(c.url).origin === self.location.origin);
      if (client) {
        client.postMessage({ type: "trova-open", open });
        return client.focus();
      }
      return self.clients.openWindow(open ? `/?open=${encodeURIComponent(open)}` : "/");
    }),
  );
});
