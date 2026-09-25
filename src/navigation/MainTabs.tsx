import { Feather } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { getPendingJobs, type PendingJob } from "@/lib/api/places";
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

function countInProgress(jobs: PendingJob[] | undefined): number {
  return (jobs ?? []).filter((job) => job.status !== "FAILED").length;
}

export function MainTabs() {
  // 처리 화면에서 나와 다른 탭을 보고 있으면 분석이 끝났는지 알 길이 없었다 — 영상 기록 탭에
  // 진행 중(대기·처리 중) 개수를 배지로 띄운다. 실패 기록은 세지 않는다. 진행 중인 게 있을 때만
  // 5초마다 다시 확인하고, 처리 화면·홈 제출 확인도 같은 캐시 키를 갱신하므로 새 제출이 바로 반영된다.
  const pendingQuery = useQuery({
    queryKey: ["pendingJobs"],
    queryFn: getPendingJobs,
    refetchInterval: (query) => (countInProgress(query.state.data) > 0 ? 5000 : false),
  });
  const inProgressCount = countInProgress(pendingQuery.data);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerTitleAlign: "center",
        // 헤더 높이는 고정이라 제목이 글자 크기 설정을 따라 커지면 잘린다(최대 크기에서 실측).
        // iOS 기본 내비게이션 바 제목처럼 크기를 고정한다 — 본문은 AppText에서 1.4배까지 커진다.
        headerTitleAllowFontScaling: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: { borderTopColor: colors.border },
        tabBarIcon: ({ color, size }) => <Feather name={TAB_ICON[route.name]} size={size} color={color} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Trova", tabBarLabel: "홈" }} />
      <Tab.Screen
        name="PlacesList"
        component={PlacesListScreen}
        options={{
          title: "영상 기록",
          tabBarLabel: "영상 기록",
          tabBarBadge: inProgressCount > 0 ? inProgressCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.onAccent, fontSize: 11 },
        }}
      />
      <Tab.Screen name="TripsList" component={TripsListScreen} options={{ title: "내 여행", tabBarLabel: "내 여행" }} />
      <Tab.Screen name="SavedPlaces" component={SavedPlacesScreen} options={{ title: "찜한 장소", tabBarLabel: "찜한 장소" }} />
      <Tab.Screen name="MyPage" component={MyPageScreen} options={{ title: "마이페이지", tabBarLabel: "마이페이지" }} />
    </Tab.Navigator>
  );
}
