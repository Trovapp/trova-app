import type { NavigationProp } from "@react-navigation/native";
import type { RootStackParamList } from "./types";

// 여행을 막 만들었을 때 여행 상세로 간다. 예전엔 만든 화면(영상 속 장소·초안)을 여행 상세로 바꿔치기만 해서,
// 뒤로 가면 영상 속 장소로 돌아가고 "저장됐다"는 표시도 끝내는 버튼도 없었다(2026-10-13 PWA 실사용).
// 스택을 [내 여행 목록, 여행 상세]로 다시 쌓아 뒤로 가면 내 여행으로 가고, 상세 위에는 저장 안내와 "완료"를 보인다.
export function openCreatedTrip(navigation: NavigationProp<RootStackParamList>, tripId: number) {
  navigation.reset({
    index: 1,
    routes: [
      { name: "MainTabs", params: { screen: "TripsList" } },
      { name: "TripDetail", params: { id: tripId, justCreated: true } },
    ],
  });
}
