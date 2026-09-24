import { Pressable } from "react-native";
import type { PressableProps, StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle> };

// 토스 스타일 누름 피드백 — 눌리는 순간 살짝(0.97) 작아졌다가 스프링으로 복귀한다.
// "동작 줄이기"(reduce motion) 켜져 있으면 스케일 자체를 안 건드려서 접근성 설정을
// 존중한다. 버튼/카드처럼 "누를 수 있다"는 걸 알려줘야 하는 곳에 Pressable 대신
// 이걸 쓴다 — 화면 끝까지 닿는 리스트 행에는 스케일 대신 PressableRow(배경 하이라이트)를
// 쓴다(행 전체가 스케일되면 "화면이 눌리는" 것처럼 보임, expo-animation 스킬 지침).
export function PressableScale({ style, onPressIn, onPressOut, children, ...props }: Props) {
  const scale = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => {
        if (!reducedMotion) {
          scale.set(withSpring(0.97, { duration: 300, dampingRatio: 0.85 }));
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reducedMotion) {
          scale.set(withSpring(1, { duration: 300, dampingRatio: 0.85 }));
        }
        onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
