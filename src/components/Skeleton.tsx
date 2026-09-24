import { View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import { colors } from "@/lib/theme";

// 화면 위에서 밝기가 오르내리는 모양이라 "이동/변형" 계열 완화 곡선을 쓴다
// (expo-animation 스킬: 화면 위 움직임엔 ease-in-out). withTiming의 easing은
// Easing.bezier(...)를 쓴다 — CSS 트랜지션용 cubicBezier(...)와는 다른 타입.
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

// 로딩 중임을 보여주는 펄스 블록 — 실제 콘텐츠와 같은 자리/크기를 차지해서
// 레이아웃이 갑자기 안 튄다. "동작 줄이기" 켜져 있으면 고정 회색으로만 표시.
export function Skeleton({ style }: { style?: ViewStyle }) {
  const opacity = useSharedValue(0.5);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    opacity.set(withRepeat(withTiming(1, { duration: 700, easing: EASE_IN_OUT }), -1, true));
  }, [opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 0.7 : opacity.get(),
  }));

  return (
    <Animated.View
      style={[{ backgroundColor: colors.borderSubtle, borderRadius: 8 }, style, animatedStyle]}
    />
  );
}

export function SkeletonRow() {
  return (
    <View style={{ paddingVertical: 14, gap: 6 }}>
      <Skeleton style={{ width: "55%", height: 15 }} />
      <Skeleton style={{ width: "35%", height: 12 }} />
    </View>
  );
}
