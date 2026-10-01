import { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/lib/theme";

// 앱이 "살아서 일하고 있다"는 느낌을 주는 상태 표시. 작은 빛 점들이 상태에 따라 모였다 흩어진다.
// 긴 AI 대기(영상 분석·재구성·AI 대화)에만 쓴다 — 짧은 로딩은 기존 스피너/스켈레톤을 그대로 둔다.
// 네이티브 재빌드가 필요 없도록 Reanimated + View만 쓴다.
export type OrbState = "waiting" | "thinking" | "searching" | "settling" | "arrived";

type Motion = {
  spread: number; // 점들이 퍼진 정도(영역 반지름 대비)
  speed: number; // 회전 빠르기
  pulse: number; // 바깥으로 퍼졌다 모이는 폭(탐색)
};

// 상태마다 "모인 정도"와 "속도"만 바꾼다 — 같은 점들이 계속 이어서 움직여 한 존재처럼 느껴지게 한다.
const MOTION: Record<OrbState, Motion> = {
  waiting: { spread: 0.75, speed: 0.04, pulse: 0 }, // 느슨하게 떠 있음
  thinking: { spread: 0.38, speed: 0.22, pulse: 0 }, // 가운데로 모여 맴돎
  searching: { spread: 0.8, speed: 0.12, pulse: 0.35 }, // 퍼져나갔다 모이기를 반복
  settling: { spread: 0.28, speed: 0.06, pulse: 0 }, // 작게 모여 가라앉음
  arrived: { spread: 1.0, speed: 0.14, pulse: 0.12 }, // 답이 도착한 순간 한 번 활짝 퍼짐(호출부가 잠시 뒤 다른 상태로 돌린다)
};

// ProgressHero 카드 팔레트에 이미 있는 금색 — 강조색과 섞여 따뜻한 빛처럼 보이게 한다.
const GOLD = "#D9A441";
const PALETTE = [colors.accent, GOLD, colors.accent, "#F2B8A8"];
const TRANSITION_MS = 900;

type Particle = {
  radius: number; // 궤도 반경 배율(0~1)
  speed: number; // 개별 속도 배율(음수면 반대 방향)
  phase: number; // 시작 각도
  wobble: number; // 궤도가 출렁이는 정도
  dot: number; // 점 지름 배율
  color: string;
  twinkle: number; // 반짝임 주기 배율
};

// 매 렌더마다 바뀌지 않도록 고정 시드로 만든다(같은 개수면 늘 같은 배치).
function makeParticles(count: number): Particle[] {
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  return Array.from({ length: count }, (_, i) => ({
    // 가운데에 더 많이 모이게(지수 > 1) — 고르게 퍼지면 색종이를 뿌린 것처럼 보인다.
    radius: 0.12 + Math.pow(rand(), 1.4) * 0.88,
    speed: (0.6 + rand() * 0.8) * (i % 3 === 0 ? -1 : 1),
    phase: rand() * Math.PI * 2,
    wobble: 0.08 + rand() * 0.18,
    dot: 0.6 + rand() * 0.8,
    color: PALETTE[i % PALETTE.length],
    twinkle: 0.5 + rand() * 1.5,
  }));
}

function Dot({
  p,
  area,
  dotSize,
  clock,
  spread,
  pulse,
}: {
  p: Particle;
  area: number;
  dotSize: number;
  clock: SharedValue<number>;
  spread: SharedValue<number>;
  pulse: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const t = clock.value;
    const angle = p.phase + t * Math.PI * 2 * p.speed;
    // 탐색 상태에서는 점마다 조금씩 어긋난 박자로 바깥으로 퍼졌다 돌아온다.
    const breathe = 1 + pulse.value * Math.sin(t * Math.PI * 2 * 0.6 + p.phase);
    const wobble = 1 + p.wobble * Math.sin(t * Math.PI * 2 * 0.3 + p.phase * 2);
    const r = (area / 2) * spread.value * p.radius * breathe * wobble;
    const twinkle = 0.55 + 0.45 * Math.sin(t * Math.PI * 2 * p.twinkle + p.phase);
    return {
      opacity: twinkle,
      transform: [{ translateX: Math.cos(angle) * r }, { translateY: Math.sin(angle) * r }],
    };
  });
  const d = dotSize * p.dot;
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: d,
          height: d,
          borderRadius: d / 2,
          backgroundColor: p.color,
          // 점마다 은은한 빛 번짐(iOS 그림자) — 딱딱한 점이 아니라 빛 알갱이처럼 보이게 한다.
          shadowColor: p.color,
          shadowOpacity: 0.8,
          shadowRadius: d,
          shadowOffset: { width: 0, height: 0 },
        },
        style,
      ]}
    />
  );
}

export function Orb({
  state,
  size = 160,
  label = "분석 중",
  still = false,
  clock: sharedClock,
}: {
  state: OrbState;
  size?: number;
  label?: string;
  // 같은 존재를 여러 곳에 그릴 때(지나간 대화의 아바타 등) 움직이는 건 하나만 두려고 멈춘 모습으로 그린다.
  still?: boolean;
  // 바깥에서 시계를 넘기면 그 시계로 움직인다. 같은 존재가 다른 자리로 옮겨 그려질 때(대화의 다음 줄)
  // 새로 마운트돼도 움직임이 처음부터 다시 시작하지 않고 이어진다(2026-10).
  clock?: SharedValue<number>;
}) {
  const reducedMotion = useReducedMotion() || still;
  const motion = MOTION[state];
  // 작은 자리(대화 말풍선 등)에서는 점을 줄여야 뭉개지지 않는다.
  const particles = useMemo(() => makeParticles(size < 32 ? 6 : size < 48 ? 7 : 28), [size]);
  const dotSize = Math.max(size < 32 ? 2.6 : 3, size * 0.055);

  const ownClock = useSharedValue(0);
  const clock = sharedClock ?? ownClock;
  const speed = useSharedValue(motion.speed);
  const spread = useSharedValue(motion.spread);
  const pulse = useSharedValue(motion.pulse);

  // 속도가 바뀌어도 점이 튀지 않도록, 시계를 "경과 시간 × 현재 속도"로 누적한다.
  const frame = useFrameCallback((info) => {
    const dt = (info.timeSincePreviousFrame ?? 16) / 1000;
    clock.value += dt * speed.value * 5;
  }, false);

  // "동작 줄이기"가 켜져 있으면 멈춘 점 무리만 보여준다.
  useEffect(() => {
    frame.setActive(!reducedMotion);
    return () => frame.setActive(false);
  }, [reducedMotion, frame]);

  useEffect(() => {
    const config = { duration: TRANSITION_MS, easing: Easing.inOut(Easing.cubic) };
    speed.value = withTiming(motion.speed, config);
    spread.value = withTiming(motion.spread, config);
    pulse.value = withTiming(reducedMotion ? 0 : motion.pulse, config);
  }, [motion.speed, motion.spread, motion.pulse, reducedMotion, speed, spread, pulse]);

  return (
    <View
      style={{ width: size * 1.4, height: size * 1.4, alignItems: "center", justifyContent: "center" }}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      {particles.map((p, i) => (
        <Dot key={i} p={p} area={size} dotSize={dotSize} clock={clock} spread={spread} pulse={pulse} />
      ))}
    </View>
  );
}
