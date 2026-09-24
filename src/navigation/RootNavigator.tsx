import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "@/lib/auth/AuthContext";
import { LoginScreen } from "@/screens/LoginScreen";
import { MainTabs } from "@/navigation/MainTabs";
import { ProcessingScreen } from "@/screens/ProcessingScreen";
import { VideoGroupScreen } from "@/screens/VideoGroupScreen";
import { NewTripScreen } from "@/screens/NewTripScreen";
import { TripDetailScreen } from "@/screens/TripDetailScreen";
import { TripReplanScreen } from "@/screens/TripReplanScreen";
import { AppText } from "@/components/AppText";
import { QueryErrorView } from "@/components/QueryErrorView";
import { View } from "react-native";
import type { RootStackParamList } from "@/navigation/types";

export type { RootStackParamList };

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { user, loading, authError, refresh } = useAuth();

  if (loading) {
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
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="Processing" component={ProcessingScreen} options={{ headerShown: false }} />
          <Stack.Screen name="VideoGroup" component={VideoGroupScreen} options={{ title: "영상 속 장소" }} />
          <Stack.Screen name="NewTrip" component={NewTripScreen} options={{ title: "새 여행" }} />
          <Stack.Screen name="TripDetail" component={TripDetailScreen} options={{ title: "여행 상세" }} />
          <Stack.Screen name="TripReplan" component={TripReplanScreen} options={{ headerShown: false }} />
        </>
      )}
    </Stack.Navigator>
  );
}
