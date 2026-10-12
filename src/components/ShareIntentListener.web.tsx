import { useEffect } from "react";
import { extractFirstUrl } from "@/lib/shareUrl";
import { setPendingShare } from "@/lib/pendingShare";
import { navigationRef } from "@/navigation/navigationRef";

// 웹(PWA)의 공유 받기(ADR 0013): 안드로이드는 manifest의 share_target으로 /share/?url=&text=&title= 로 열린다.
// 받은 링크를 앱과 같은 "공유 대기"에 넣고 주소를 / 로 되돌린다(새로고침해도 다시 저장되지 않게).
export function ShareIntentListener() {
  useEffect(() => {
    const { pathname, search } = window.location;
    if (!pathname.startsWith("/share")) return;
    const params = new URLSearchParams(search);
    const raw = [params.get("url"), params.get("text"), params.get("title")].filter(Boolean).join(" ");
    window.history.replaceState(null, "", "/");
    if (!raw.trim()) return;
    setPendingShare(extractFirstUrl(raw));
    if (navigationRef.isReady()) {
      navigationRef.navigate("MainTabs", { screen: "Home" });
    }
  }, []);

  return null;
}
