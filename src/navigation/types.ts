import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

// 홈/영상 기록/내 여행/저장 장소는 하단 탭바(MainTabs)에 항상 떠 있는 주요 목적지이고,
// 나머지(Login/Processing/VideoGroup/NewTrip/TripDetail)는 탭 위에 쌓이는 흐름/상세
// 화면이라 바깥 스택에 남겨둔다 — 네이버 지도/야놀자류 앱의 탭+스택 조합과 동일한 구조.
export type MainTabParamList = {
  Home: undefined;
  PlacesList: undefined;
  TripsList: undefined;
  SavedPlaces: undefined;
  MyPage: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined;
  Processing: { jobId: number };
  VideoGroup: { jobId: number };
  NewTrip: undefined;
  TripDetail: { id: number };
  TripReplan: { tripId: number; jobId: number };
  Licenses: undefined;
};

// 탭 화면(MainTabParamList)에서도 바깥 스택 화면(Processing/VideoGroup/TripDetail 등)으로
// navigate할 수 있어야 하므로, 탭 자신의 라우트 + 바깥 스택 라우트를 합성한 타입을 쓴다.
export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
