import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { setPlanLimitHandler } from "@/lib/api/client";
import { navigationRef } from "@/navigation/navigationRef";

// 무료·여행 패스 한도에 닿으면(서버 402) 어느 화면이든 같은 안내를 띄운다(2026-10-05).
// 무료 사용자에게는 여행 패스로 가는 버튼을, 패스 사용자에게는 언제 다시 쓸 수 있는지만 알린다.
export function PlanLimitListener() {
  const lastShownAt = useRef(0);

  useEffect(() => {
    setPlanLimitHandler((err) => {
      // 한 동작이 요청을 여러 번 보내도 안내는 한 번만.
      const now = Date.now();
      if (now - lastShownAt.current < 3000) return;
      lastShownAt.current = now;
      const message = err.userMessage ?? "이번 달 무료 횟수를 모두 썼어요.";
      if (err.onPass) {
        Alert.alert("오늘은 여기까지예요", message);
        return;
      }
      Alert.alert("무료 횟수를 다 썼어요", message, [
        { text: "닫기", style: "cancel" },
        {
          text: "여행 패스 보기",
          onPress: () => {
            if (navigationRef.isReady()) navigationRef.navigate("Pass", { feature: err.feature });
          },
        },
      ]);
    });
    return () => setPlanLimitHandler(null);
  }, []);

  return null;
}
