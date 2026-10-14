import { useEffect } from "react";
import { Platform } from "react-native";
import type * as NotificationsModule from "expo-notifications";
import { useAuth } from "@/lib/auth/AuthContext";
import { setPendingOpen, takePendingOpen } from "@/lib/pendingOpen";
import { parseOpenTarget, type OpenTarget } from "@/lib/pushLogic";
import { navigationRef } from "@/navigation/navigationRef";

// 안드로이드 앱 알림을 눌러 연 화면(백엔드 #190, ADR 0017). 웹은 PushOpenListener.web.tsx(같은 이동 규칙).
// 앱이 꺼져 있다 알림으로 열렸으면 마지막 응답을, 켜져 있으면 응답 이벤트를 받는다. 로그인 전이면 담아 두었다가 로그인 뒤 연다.
// 아이폰 네이티브 앱은 알림이 없어 아무것도 하지 않는다.
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

// 아이폰 개발 빌드에는 알림 네이티브 모듈이 없어 안드로이드에서만 불러온다(push.ts와 같은 이유).
const Notifications: typeof NotificationsModule | null =
  Platform.OS === "android" ? require("expo-notifications") : null;

function targetOf(response: NotificationsModule.NotificationResponse | null): OpenTarget | null {
  const open = response?.notification.request.content.data?.open;
  return typeof open === "string" ? parseOpenTarget(open) : null;
}

export function PushOpenListener() {
  const { user } = useAuth();

  useEffect(() => {
    if (!Notifications) return;
    const notifications = Notifications;
    // 꺼진 상태에서 알림으로 열린 경우 — 한 번만 처리되도록 응답을 지운다.
    notifications
      .getLastNotificationResponseAsync()
      .then((response) => {
        const target = targetOf(response);
        if (target) setPendingOpen(target);
        return notifications.clearLastNotificationResponseAsync();
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!Notifications) return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const target = targetOf(response);
      if (!target) return;
      if (navigationRef.isReady() && user) go(target);
      else setPendingOpen(target);
    });
    return () => subscription.remove();
  }, [user]);

  useEffect(() => {
    if (Platform.OS !== "android" || !user) return;
    // 로그인 직후엔 화면 전환 중이고, 꺼진 상태에서 열린 알림은 비동기로 늦게 담길 수 있어 몇 초 동안 살핀다.
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      if (ticks > 50) clearInterval(timer);
      if (!navigationRef.isReady()) return;
      const target = takePendingOpen();
      if (target) {
        clearInterval(timer);
        go(target);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [user]);

  return null;
}
