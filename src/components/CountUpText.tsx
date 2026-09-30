import { useEffect, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";
import { AppText } from "@/components/AppText";
import type { TextStyle } from "react-native";

// 숫자가 0부터 목표값까지 빠르게 세어 올라간다 — 결과가 "도착하는" 순간에만 쓴다.
// "동작 줄이기"가 켜져 있으면 바로 최종 값을 보여준다.
export function CountUpText({
  value,
  suffix = "",
  durationMs = 700,
  animate = true,
  style,
  weight,
}: {
  value: number;
  suffix?: string;
  durationMs?: number;
  animate?: boolean;
  style?: TextStyle;
  weight?: "regular" | "medium" | "bold";
}) {
  const reducedMotion = useReducedMotion();
  const skip = !animate || reducedMotion;
  const [shown, setShown] = useState(skip ? value : 0);

  useEffect(() => {
    if (skip) {
      setShown(value);
      return;
    }
    const start = Date.now();
    let frame: number;
    const tick = () => {
      const t = Math.min((Date.now() - start) / durationMs, 1);
      // 끝으로 갈수록 느려지게(ease-out) — 마지막 숫자에 착지하는 느낌.
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs, skip]);

  return (
    <AppText weight={weight} style={style}>
      {shown}
      {suffix}
    </AppText>
  );
}
