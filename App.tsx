import { useEffect, useRef } from "react";
import { AppState, useWindowDimensions } from "react-native";
import { useFonts as useMonoFonts, IBMPlexMono_400Regular, IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono";
import { useFonts as useEmojiFonts, useFonts as useSansFonts } from "expo-font";
import { FONT } from "@/components/AppText";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, type NavigationState } from "@react-navigation/native";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { shouldRetryQuery } from "@/lib/api/client";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { RootNavigator } from "@/navigation/RootNavigator";
import { navigationRef } from "@/navigation/navigationRef";
import { ShareIntentListener } from "@/components/ShareIntentListener";
import { PlanLimitListener } from "@/components/PlanLimitListener";
import { PendingPurchaseSync } from "@/components/PendingPurchaseSync";

SplashScreen.preventAutoHideAsync().catch(() => {});

// 조회 재시도: 기본값(3번, 1·2·4초 대기)이면 네트워크가 끊겼을 때 오류 안내까지 ~7초 스켈레톤만 보이고,
// 로그인 만료(401)·없는 데이터(404)처럼 다시 해도 같은 4xx까지 재시도한다.
// 4xx는 바로 실패로, 네트워크/서버 오류(5xx)만 1번 재시도한다. (쓰기 요청은 기본값대로 재시도하지 않음)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
    },
  },
});

// React Query의 "창 포커스 시 재조회"는 웹 이벤트 기준이라 RN에선 동작하지 않는다.
// 앱이 백그라운드에서 돌아오면(active) 포커스로 알려서 오래된 목록을 자동으로 다시 불러온다.
AppState.addEventListener("change", (status) => {
  focusManager.setFocused(status === "active");
});

export default function App() {
  // 앱이 켜진 채로 iOS "글자 크기"를 바꾸면, 그때 뒤에 숨어 있던 화면(다른 탭, 아래 깔린 화면)은 칸 크기를 다시 재지 않아
  // 커진 글자가 잘렸다(디자인 QA D1 — 테스트 시뮬레이터에서 재현: 보던 화면과 새로 여는 화면은 정상, 숨어 있던 화면만 잘림).
  // 글자 배율이 바뀌면 화면들을 새로 그리되, 보던 위치(내비게이션 상태)는 그대로 되살린다. 입력 중이던 값은 사라진다.
  const { fontScale } = useWindowDimensions();
  const navState = useRef<NavigationState | undefined>(undefined);
  const [monoFontsLoaded] = useMonoFonts({
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });
  const [sansFontsLoaded] = useSansFonts({
    [FONT.regular]: require("./assets/fonts/pretendard/Pretendard-Regular.otf"),
    [FONT.medium]: require("./assets/fonts/pretendard/Pretendard-Medium.otf"),
    [FONT.bold]: require("./assets/fonts/pretendard/Pretendard-Bold.otf"),
  });
  // 별점/팁/리뷰 반응처럼 감성적인 자리에만 쓰는 이모지 폰트 — 토스가 자체
  // 스타일로 다시 그린 이모지 세트 (github.com/toss/tossface, 라이선스는
  // assets/fonts/TOSSFACE_LICENSE.txt 참고). 탭바·버튼 같은 기능성 아이콘은
  // 계속 Feather를 쓴다.
  const [emojiFontLoaded] = useEmojiFonts({
    Tossface: require("./assets/fonts/TossFaceFontMac.ttf"),
  });
  const fontsLoaded = monoFontsLoaded && sansFontsLoaded && emojiFontLoaded;

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SafeAreaProvider>
            <StatusBar style="dark" />
            {/* BottomSheetModal(드래그로 닫히는 시트)을 화면 어디서든 present()로 띄우려면
                루트에 한 번만 이 Provider가 있으면 된다 — SavedPlacesScreen의 상시 마운트된
                BottomSheet와 달리, DayPickerSheet 등 필요할 때만 뜨는 시트들이 이걸 쓴다. */}
            <AppErrorBoundary>
              <BottomSheetModalProvider>
                <NavigationContainer
                  ref={navigationRef}
                  key={fontScale}
                  initialState={navState.current}
                  onStateChange={(state) => {
                    navState.current = state;
                  }}
                >
                  <RootNavigator />
                </NavigationContainer>
                <ShareIntentListener />
                <PlanLimitListener />
                <PendingPurchaseSync />
              </BottomSheetModalProvider>
            </AppErrorBoundary>
          </SafeAreaProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
