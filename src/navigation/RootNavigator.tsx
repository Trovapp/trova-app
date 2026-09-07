import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "@/lib/auth/AuthContext";
import { LoginScreen } from "@/screens/LoginScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { ProcessingScreen } from "@/screens/ProcessingScreen";
import { PlacesListScreen } from "@/screens/PlacesListScreen";
import { VideoGroupScreen } from "@/screens/VideoGroupScreen";
import { TripsListScreen } from "@/screens/TripsListScreen";
import { NewTripScreen } from "@/screens/NewTripScreen";
import { TripDetailScreen } from "@/screens/TripDetailScreen";
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
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Trova" }} />
          <Stack.Screen name="Processing" component={ProcessingScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PlacesList" component={PlacesListScreen} options={{ title: "저장한 장소" }} />
          <Stack.Screen name="VideoGroup" component={VideoGroupScreen} options={{ title: "영상 속 장소" }} />
          <Stack.Screen name="TripsList" component={TripsListScreen} options={{ title: "내 여행" }} />
          <Stack.Screen name="NewTrip" component={NewTripScreen} options={{ title: "새 여행" }} />
          <Stack.Screen name="TripDetail" component={TripDetailScreen} options={{ title: "여행 상세" }} />
        </>
      )}
    </Stack.Navigator>
  );
}
