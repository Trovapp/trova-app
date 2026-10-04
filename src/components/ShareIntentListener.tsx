import { useEffect } from "react";
import { ShareIntentModule, useShareIntent } from "expo-share-intent";
import { extractFirstUrl } from "@/lib/shareUrl";
import { setPendingShare } from "@/lib/pendingShare";
import { navigationRef } from "@/navigation/navigationRef";

// 공유 확장(expo-share-intent)으로 들어온 링크를 받아 홈으로 보낸다. 네이티브 모듈이 없는 예전 빌드에서는 끈다.
export function ShareIntentListener() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({ disabled: ShareIntentModule == null });

  useEffect(() => {
    if (!hasShareIntent) return;
    const raw = shareIntent.webUrl ?? shareIntent.text ?? "";
    resetShareIntent();
    if (!raw.trim()) return;
    setPendingShare(extractFirstUrl(raw));
    if (navigationRef.isReady()) {
      navigationRef.navigate("MainTabs", { screen: "Home" });
    }
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  return null;
}
