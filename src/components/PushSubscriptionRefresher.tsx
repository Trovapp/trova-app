import { useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { refreshPushSubscription } from "@/lib/push";

// 앱을 열 때(로그인 상태가 되면) 웹 푸시 구독을 서버에 다시 보낸다(백엔드 #185) — 구독이 바뀌거나 지워졌어도 되살린다.
// 권한이 없으면 아무것도 묻지 않는다. 앱(네이티브)은 push.ts가 아무것도 하지 않는다.
export function PushSubscriptionRefresher() {
  const { user } = useAuth();
  useEffect(() => {
    if (user) refreshPushSubscription().catch(() => {});
  }, [user]);
  return null;
}
