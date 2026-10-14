import { useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { setPendingOpen, takePendingOpen } from "@/lib/pendingOpen";
import { parseOpenTarget, withoutOpenParam, type OpenTarget } from "@/lib/pushLogic";
import { navigationRef } from "@/navigation/navigationRef";

// 웹 푸시를 눌러 연 화면(백엔드 #185). 앱이 꺼져 있었으면 /?open=, 열려 있었으면 서비스 워커 메시지로 온다.
// 로그인이 풀려 있으면 담아 두었다가 로그인 뒤 연다. 스택은 [홈 탭, 대상]으로 바꿔 뒤로 가면 홈이다
// (초안·여행이 없으면 각 화면의 "찾을 수 없어요" 안내가 뜨고 뒤로 가면 홈).
function go(target: OpenTarget) {
  navigationRef.reset({
    index: 1,
    routes: [
      { name: "MainTabs", params: { screen: "Home" } },
      target.kind === "draft"
        ? { name: "PlanTrip", params: { draftId: target.draftId } }
        : { name: "TripDetail", params: { id: target.tripId, weatherAlertTripPlaceId: target.tripPlaceId } },
    ],
  });
}

// 첫 화면 주소(/?open=)는 앱이 시작할 때 한 번만 읽는다 — 다시 렌더돼도 두 번 열지 않게 모듈에서 꺼낸다.
const initialParams = new URLSearchParams(window.location.search);
if (initialParams.has("open")) {
  const target = parseOpenTarget(initialParams.get("open"));
  window.history.replaceState(null, "", withoutOpenParam(window.location.search));
  if (target) setPendingOpen(target);
}

export function PushOpenListener() {
  const { user } = useAuth();

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.type !== "trova-open") return;
      const target = parseOpenTarget(event.data.open);
      if (!target) return;
      if (navigationRef.isReady() && user) go(target);
      else setPendingOpen(target);
    }
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // 로그인 직후엔 화면 전환 중이라 내비게이션이 준비될 때까지 잠깐 기다린다.
    const timer = setInterval(() => {
      if (!navigationRef.isReady()) return;
      clearInterval(timer);
      const target = takePendingOpen();
      if (target) go(target);
    }, 100);
    return () => clearInterval(timer);
  }, [user]);

  return null;
}
