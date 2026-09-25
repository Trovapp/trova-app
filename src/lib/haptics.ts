import * as Haptics from "expo-haptics";

// reduced-motion처럼 전역에서 끌 수 있는 스위치 — 아직 설정 화면은 없지만, 나중에
// "진동 끄기" 옵션을 추가할 때 이 한 줄만 연결하면 되게 미리 갈라둔다.
let enabled = true;

export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

export const haptics = {
  // 값이 스텝을 넘어갈 때 — 피커, 세그먼트 선택
  selection: () => {
    if (enabled) Haptics.selectionAsync();
  },
  // 뭔가 제자리에 스냅될 때 — 드래그 순서 변경 확정. 바텀시트 닫힘에는 쓰지 않는다(iOS 기본 시트도
  // 닫힐 때 진동이 없고, 메뉴 선택 → 시트 닫힘 → 삭제 경고로 이어지면 연달아 두 번 울려 의미가 흐려짐).
  light: () => {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  // 삭제/탈퇴 등 되돌리기 번거로운 동작을 실행하는 순간
  warning: () => {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },
  // 여행 확정/재구성 완료처럼 여러 단계짜리 작업이 끝났을 때
  success: () => {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
};
