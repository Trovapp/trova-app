import { Feather } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HomeScreen } from "@/screens/HomeScreen";
import { MyPageScreen } from "@/screens/MyPageScreen";
import { PlacesListScreen } from "@/screens/PlacesListScreen";
import { SavedPlacesScreen } from "@/screens/SavedPlacesScreen";
import { TripsListScreen } from "@/screens/TripsListScreen";
import { colors } from "@/lib/theme";
import type { MainTabParamList } from "@/navigation/types";

const Tab = createBottomTabNavigator<MainTabParamList>();

// 지도핀·달력 아이콘은 웹(trova-frontend Header.tsx)의 저장한 장소/내 여행 아이콘과
// 같은 Feather 모양(map-pin, calendar)이라 웹과 시각적으로 통일된다.
const TAB_ICON: Record<keyof MainTabParamList, keyof typeof Feather.glyphMap> = {
  Home: "home",
  PlacesList: "film",
  TripsList: "calendar",
  SavedPlaces: "map-pin",
  MyPage: "user",
};

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerTitleAlign: "center",
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: { borderTopColor: colors.border },
        tabBarIcon: ({ color, size }) => <Feather name={TAB_ICON[route.name]} size={size} color={color} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Trova", tabBarLabel: "홈" }} />
      <Tab.Screen name="PlacesList" component={PlacesListScreen} options={{ title: "영상 기록", tabBarLabel: "영상 기록" }} />
      <Tab.Screen name="TripsList" component={TripsListScreen} options={{ title: "내 여행", tabBarLabel: "내 여행" }} />
      <Tab.Screen name="SavedPlaces" component={SavedPlacesScreen} options={{ title: "저장 장소", tabBarLabel: "저장 장소" }} />
      <Tab.Screen name="MyPage" component={MyPageScreen} options={{ title: "마이페이지", tabBarLabel: "마이페이지" }} />
    </Tab.Navigator>
  );
}
