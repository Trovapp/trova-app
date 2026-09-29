import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/lib/theme";

// 앱이 "살아서 일하고 있다"는 느낌을 주는 상태 표시용 오브. 긴 AI 대기(영상 분석 등)에만 쓴다 —
// 목록 새로고침 같은 짧은 로딩은 기존 스피너/스켈레톤을 그대로 둔다(움직임이 너무 많으면 피로하다).
// 네이티브 재빌드가 필요 없도록 Reanimated + 둥근 View 여러 겹으로만 그린다.
export type OrbState = "waiting" | "thinking" | "searching" | "settling";

type Motion = {
  breathMs: number; // 숨쉬기 한 번(커졌다 작아짐)의 절반 주기
  breathScale: number; // 숨쉴 때 최대 크기 배율
  swirlMs: number; // 안쪽 구슬이 한 바퀴 도는 시간
  swirlRadius: number; // 안쪽 구슬이 도는 반경(오브 지름 대비)
  glow: number; // 바깥 빛 번짐의 세기(0~1)
  ripple: boolean; // 바깥으로 퍼지는 물결(무언가를 찾는 중)
};

// 상태마다 "속도"와 "에너지"만 바꾼다 — 모양은 같게 두어 단계가 바뀌어도 같은 존재로 느껴지게 한다.
const MOTION: Record<OrbState, Motion> = {
  waiting: { breathMs: 3200, breathScale: 1.04, swirlMs: 14000, swirlRadius: 0.08, glow: 0.25, ripple: false },
  thinking: { breathMs: 2000, breathScale: 1.08, swirlMs: 4800, swirlRadius: 0.17, glow: 0.5, ripple: false },
  searching: { breathMs: 1500, breathScale: 1.05, swirlMs: 2800, swirlRadius: 0.13, glow: 0.45, ripple: true },
  settling: { breathMs: 2600, breathScale: 1.02, swirlMs: 9000, swirlRadius: 0.05, glow: 0.3, ripple: false },
};

// ProgressHero 카드 팔레트에 이미 있는 금색 — 강조색과 섞여 따뜻한 빛처럼 보이게 한다.
const GOLD = "#D9A441";
const RIPPLE_MS = 1800;

// 블러 없이 부드러운 빛을 내려고, 같은 중심의 원을 크기를 줄여가며 여러 겹 쌓는다 —
// 가운데로 갈수록 겹이 많아져 진하고 가장자리는 옅어지는 방사형 그라데이션처럼 보인다.
function SoftCircle({ diameter, color, opacity, steps = 10 }: { diameter: number; color: string; opacity: number; steps?: number }) {
  return (
    <>
      {Array.from({ length: steps }, (_, i) => {
        const d = diameter * (1 - (i / steps) * 0.85);
        return (
          <View
            key={i}
            style={{ position: "absolute", width: d, height: d, borderRadius: d / 2, backgroundColor: color, opacity: opacity / steps * 1.6 }}
          />
        );
      })}
    </>
  );
}

export function Orb({ state, size = 160 }: { state: OrbState; size?: number }) {
  const reducedMotion = useReducedMotion();
  const motion = MOTION[state];

  const breath = useSharedValue(0);
  const swirl = useSharedValue(0);
  const ripple = useSharedValue(0);

  useEffect(() => {
    // "동작 줄이기"가 켜져 있으면 움직이지 않는 오브만 보여준다.
    if (reducedMotion) {
      cancelAnimation(breath);
      cancelAnimation(swirl);
      cancelAnimation(ripple);
      return;
    }
    // 상태가 바뀌면 지금 위치에서 새 속도로 이어서 움직인다(처음으로 튀지 않게).
    breath.value = withRepeat(
      withTiming(breath.value > 0.5 ? 0 : 1, { duration: motion.breathMs, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    const from = swirl.value % 1;
    swirl.value = from;
    swirl.value = withRepeat(withTiming(from + 1, { duration: motion.swirlMs, easing: Easing.linear }), -1, false);
    if (motion.ripple) {
      ripple.value = 0;
      ripple.value = withRepeat(withTiming(1, { duration: RIPPLE_MS, easing: Easing.out(Easing.quad) }), -1, false);
    } else {
      cancelAnimation(ripple);
      ripple.value = withTiming(0, { duration: 400 });
    }
  }, [state, reducedMotion, motion.breathMs, motion.swirlMs, motion.ripple, breath, swirl, ripple]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: motion.glow * 2 * interpolate(breath.value, [0, 1], [0.55, 1]),
    transform: [{ scale: interpolate(breath.value, [0, 1], [0.92, motion.breathScale + 0.04]) }],
  }));

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(breath.value, [0, 1], [1, motion.breathScale]) }],
  }));

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ripple.value, [0, 1], [0.35, 0]),
    transform: [{ scale: interpolate(ripple.value, [0, 1], [1, 1.7]) }],
  }));

  // 안쪽 구슬 둘은 서로 반대편에서, 다른 반경으로 돈다 — 원 두 개만으로도 안에서 무언가 흐르는 느낌이 난다.
  const blobAStyle = useAnimatedStyle(() => {
    const angle = swirl.value * Math.PI * 2;
    const r = size * motion.swirlRadius;
    return { transform: [{ translateX: Math.cos(angle) * r }, { translateY: Math.sin(angle) * r }] };
  });
  const blobBStyle = useAnimatedStyle(() => {
    const angle = -swirl.value * Math.PI * 2 + Math.PI;
    const r = size * motion.swirlRadius * 0.8;
    return { transform: [{ translateX: Math.cos(angle) * r }, { translateY: Math.sin(angle * 1.3) * r }] };
  });

  const circle = (d: number) => ({ position: "absolute" as const, width: d, height: d, borderRadius: d / 2 });

  return (
    <View
      style={{ width: size * 1.8, height: size * 1.8, alignItems: "center", justifyContent: "center" }}
      accessibilityRole="progressbar"
      accessibilityLabel="분석 중"
    >
      <Animated.View style={[circle(size * 1.6), { alignItems: "center", justifyContent: "center" }, glowStyle]}>
        <SoftCircle diameter={size * 1.6} color={colors.accent} opacity={0.5} steps={28} />
      </Animated.View>
      <Animated.View style={[circle(size), { borderWidth: 2, borderColor: colors.accent }, rippleStyle]} />
      <Animated.View
        style={[
          circle(size),
          {
            overflow: "hidden",
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: colors.accent,
            shadowOpacity: 0.45,
            shadowRadius: size * 0.18,
            shadowOffset: { width: 0, height: size * 0.06 },
          },
          coreStyle,
        ]}
      >
        <Animated.View style={[circle(size * 0.9), { alignItems: "center", justifyContent: "center" }, blobAStyle]}>
          <SoftCircle diameter={size * 0.9} color={GOLD} opacity={0.9} steps={16} />
        </Animated.View>
        <Animated.View style={[circle(size * 0.7), { alignItems: "center", justifyContent: "center" }, blobBStyle]}>
          <SoftCircle diameter={size * 0.7} color={colors.accentBg} opacity={0.7} steps={16} />
        </Animated.View>
        {/* 윗부분 반사광 — 평면 원이 아니라 빛나는 구슬처럼 보이게 한다. */}
        <View style={[circle(size * 0.5), { top: size * 0.04, left: size * 0.12, alignItems: "center", justifyContent: "center" }]}>
          <SoftCircle diameter={size * 0.5} color={colors.onAccent} opacity={0.45} steps={14} />
        </View>
      </Animated.View>
    </View>
  );
}
