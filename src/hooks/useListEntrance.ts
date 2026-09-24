import { useRef } from "react";
import { FadeInDown, useReducedMotion } from "react-native-reanimated";

// 가상화 리스트(FlatList/BottomSheetFlatList)는 행이 스크롤에서 벗어나면 언마운트됐다가
// 다시 마운트되므로, entering을 매 렌더마다 그대로 주면 스크롤할 때마다 다시 페이드인된다
// (expo-animation 스킬의 "Never put entering on a row inside FlatList" 규칙).
// 그래서 처음 화면에 보이는 몇 개(STAGGER_LIMIT)만, 그것도 딱 한 번만 애니메이션한다 —
// 이후로는 같은 key가 다시 렌더돼도(스크롤로 재마운트돼도) entering을 안 준다.
const STAGGER_LIMIT = 8;

export function useListEntrance() {
  const reducedMotion = useReducedMotion();
  const animatedKeys = useRef(new Set<string>());

  return function entranceFor(key: string | number, index: number) {
    if (reducedMotion || index >= STAGGER_LIMIT) return undefined;
    const k = String(key);
    if (animatedKeys.current.has(k)) return undefined;
    animatedKeys.current.add(k);
    return FadeInDown.delay(index * 60).springify().damping(16);
  };
}
