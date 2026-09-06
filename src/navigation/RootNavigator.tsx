import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "@/lib/auth/AuthContext";
import { LoginScreen } from "@/screens/LoginScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { PlacesListScreen } from "@/screens/PlacesListScreen";
import { PlaceDetailScreen } from "@/screens/PlaceDetailScreen";
import { MapScreen } from "@/screens/MapScreen";
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
          <Stack.Screen name="PlacesList" component={PlacesListScreen} options={{ title: "저장한 장소" }} />
          <Stack.Screen name="PlaceDetail" component={PlaceDetailScreen} options={{ title: "장소 상세" }} />
          <Stack.Screen name="Map" component={MapScreen} options={{ title: "지도" }} />
        </>
      )}
    </Stack.Navigator>
  );
}
