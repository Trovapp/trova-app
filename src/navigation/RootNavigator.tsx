import { getFocusedRouteNameFromRoute } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "@/lib/auth/AuthContext";
import { LoginScreen } from "@/screens/LoginScreen";
import { MainTabs, TAB_LABEL } from "@/navigation/MainTabs";
import { ProcessingScreen } from "@/screens/ProcessingScreen";
import { VideoGroupScreen } from "@/screens/VideoGroupScreen";
import { NewTripScreen } from "@/screens/NewTripScreen";
import { TripDetailScreen } from "@/screens/TripDetailScreen";
import { TripReplanScreen } from "@/screens/TripReplanScreen";
import { LicensesScreen } from "@/screens/LicensesScreen";
import { AppText } from "@/components/AppText";
import { QueryErrorView } from "@/components/QueryErrorView";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { OnboardingScreen } from "@/screens/OnboardingScreen";
import { hasSeenOnboarding, markOnboardingSeen } from "@/lib/onboardingStorage";
import type { MainTabParamList, RootStackParamList } from "@/navigation/types";

export type { RootStackParamList };

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { user, loading, authError, refresh } = useAuth();
  // null = 아직 기기 저장소를 읽는 중
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);
  // 개발 중 로그인한 채로 온보딩을 확인하는 미리보기 스위치. 배포 빌드(__DEV__ false)에서는 항상 꺼진다.
  const [previewOnboarding, setPreviewOnboarding] = useState(
    __DEV__ && process.env.EXPO_PUBLIC_PREVIEW_ONBOARDING === "1",
  );

  useEffect(() => {
    hasSeenOnboarding()
      .then(setOnboardingSeen)
      // 저장소를 못 읽으면 온보딩을 건너뛴다 — 로그인 자체를 막으면 안 된다.
      .catch(() => setOnboardingSeen(true));
  }, []);

  function finishOnboarding() {
    setOnboardingSeen(true);
    markOnboardingSeen().catch(() => {});
  }

  if (previewOnboarding) {
    return <OnboardingScreen onDone={() => setPreviewOnboarding(false)} />;
  }

  if (loading || (!user && onboardingSeen === null)) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AppText>불러오는 중...</AppText>
      </View>
    );
  }

  // 네트워크 오류로 로그인 여부를 확인 못 한 것과 "진짜 로그인 안 됨"(401)을
  // 구분한다 — 아니면 오프라인일 때 로그인된 사용자가 로그인 화면으로
  // 잘못 튕겨나간다.
  if (!user && authError) {
    return (
      <QueryErrorView
        fullScreen
        message="로그인 상태를 확인하지 못했어요. 네트워크 상태를 확인하고 다시 시도해주세요."
        onRetry={refresh}
      />
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerTitleAlign: "center" }}>
      {!user ? (
        onboardingSeen ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <Stack.Screen name="Onboarding" options={{ headerShown: false }}>
            {() => <OnboardingScreen onDone={finishOnboarding} />}
          </Stack.Screen>
        )
      ) : (
        <>
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            // 헤더는 숨기지만 title은 다음 화면의 iOS 뒤로가기 문구가 된다 — 지정하지 않으면 라우트 이름
            // "MainTabs"가 그대로 보였다. 지금 열려 있는 탭 이름을 써서 "‹ 내 여행"처럼 보이게 한다.
            options={({ route }) => ({
              headerShown: false,
              title: TAB_LABEL[(getFocusedRouteNameFromRoute(route) ?? "Home") as keyof MainTabParamList],
            })}
          />
          <Stack.Screen name="Processing" component={ProcessingScreen} options={{ headerShown: false }} />
          <Stack.Screen name="VideoGroup" component={VideoGroupScreen} options={{ title: "영상 속 장소" }} />
          <Stack.Screen name="NewTrip" component={NewTripScreen} options={{ title: "새 여행" }} />
          <Stack.Screen name="TripDetail" component={TripDetailScreen} options={{ title: "여행 상세" }} />
          <Stack.Screen name="TripReplan" component={TripReplanScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Licenses" component={LicensesScreen} options={{ title: "오픈소스 라이선스" }} />
        </>
      )}
    </Stack.Navigator>
  );
}
