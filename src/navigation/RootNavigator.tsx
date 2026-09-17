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
import { View } from "react-native";
import type { RootStackParamList } from "@/navigation/types";

export type { RootStackParamList };

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AppText>불러오는 중...</AppText>
      </View>
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
