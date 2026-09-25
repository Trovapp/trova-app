import { useEffect } from "react";
import { AppState } from "react-native";
import { useFonts as useMonoFonts, IBMPlexMono_400Regular, IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono";
import { useFonts as useSansFonts, NotoSansKR_400Regular, NotoSansKR_500Medium, NotoSansKR_700Bold } from "@expo-google-fonts/noto-sans-kr";
import { useFonts as useEmojiFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { RootNavigator } from "@/navigation/RootNavigator";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

// React Query의 "창 포커스 시 재조회"는 웹 이벤트 기준이라 RN에선 동작하지 않는다.
// 앱이 백그라운드에서 돌아오면(active) 포커스로 알려서 오래된 목록을 자동으로 다시 불러온다.
AppState.addEventListener("change", (status) => {
  focusManager.setFocused(status === "active");
});

export default function App() {
  const [monoFontsLoaded] = useMonoFonts({
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });
  const [sansFontsLoaded] = useSansFonts({
    NotoSansKR_400Regular,
    NotoSansKR_500Medium,
    NotoSansKR_700Bold,
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
                <NavigationContainer>
                  <RootNavigator />
                </NavigationContainer>
              </BottomSheetModalProvider>
            </AppErrorBoundary>
          </SafeAreaProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
