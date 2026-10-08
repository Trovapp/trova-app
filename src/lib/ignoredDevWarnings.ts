import { LogBox } from "react-native";

// 개발 빌드에서만 뜨는 경고 막대가 탭 바를 가려 탭이 눌리지 않았다(페르소나 QA 2026-10-08). 원인을 확인한 결과 셋 다 앱 코드가 아니다:
// - InteractionManager 폐기 예정: react-native-draggable-flatlist(여행 상세 일정 끌어 옮기기) 안에서 부름
// - onAnimatedValueUpdate 리스너 없음: React Native 네이티브 애니메이션 모듈의 알려진 경고(동작 문제 없음)
// - Reanimated 동작 줄이기 안내: 기기에서 동작 줄이기를 켜면 개발 모드에서만 알리는 정보성 문구
// 이 세 문구만 숨기고, 다른 경고는 그대로 보인다. 배포 빌드에는 원래 경고 막대가 없다.
// App보다 먼저 불러와야 한다 — Reanimated는 불러오는 순간 경고를 남겨서, App 뒤에 두면 숨기기 전에 이미 떴다(재검증에서 확인).
LogBox.ignoreLogs([
  "InteractionManager has been deprecated",
  "Sending `onAnimatedValueUpdate` with no listeners registered",
  "[Reanimated] Reduced motion setting is enabled",
]);
