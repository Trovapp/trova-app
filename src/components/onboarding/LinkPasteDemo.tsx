import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { AppText } from "@/components/AppText";
import { colors, fontSize, radius, space } from "@/lib/theme";

// 온보딩 따라하기 데모(2026-10). 참고: Plotline 온보딩의 "Share it. We'll grab the places." —
// 플랫폼 탭을 고르면 휴대폰 화면 안에서 단계가 저절로 넘어가며 사용법을 보여준다.
// 공유 확장(expo-share-intent)이 생긴 뒤에도 "링크 복사 → 붙여넣기"만 안내했다(페르소나 QA 2026-10-08, 처음 쓰는 사람) —
// 실제로 가장 쉬운 "공유 → Trova 고르기 → 일정까지 자동"을 보여 주고, 마지막 장면에서 결과(준비된 일정)를 미리 보여 준다.
export type DemoPlatform = "instagram" | "youtube";

export const DEMO_STEPS = ["공유 누르기", "Trova 고르기", "일정까지 자동"] as const;
export const DEMO_STEP_MS = 2600;

const PLATFORM = {
  instagram: { label: "인스타그램", icon: "instagram" as const, shareIcon: "send" as const, url: "instagram.com/reel/C8x…" },
  youtube: { label: "유튜브", icon: "youtube" as const, shareIcon: "share" as const, url: "youtube.com/shorts/8vmp…" },
};

// 눌러야 할 곳을 알려주는 깜빡이는 고리. 둥근 아이콘은 size만, 넓은 버튼은 width/height/round로 모양을 맞춘다.
function TapRing({ size, width, height, round = radius.full }: { size?: number; width?: number | `${number}%`; height?: number; round?: number }) {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 0 })), -1);
  }, [pulse, reducedMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 0.9 : 1 - pulse.value,
    transform: [{ scale: reducedMotion ? 1 : 1 + pulse.value * (width ? 0.12 : 0.5) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: "absolute", width: width ?? size, height: height ?? size, borderRadius: round, borderWidth: 2, borderColor: colors.accent },
        style,
      ]}
    />
  );
}

function ShareStep({ platform }: { platform: DemoPlatform }) {
  const p = PLATFORM[platform];
  return (
    <View style={{ flex: 1, backgroundColor: colors.media, padding: space.sm, justifyContent: "space-between" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.xxs }}>
        <Feather name={p.icon} size={12} color={colors.onAccent} />
        <AppText style={{ fontSize: fontSize.caption2, color: colors.onAccent }}>{platform === "instagram" ? "릴스" : "쇼츠"}</AppText>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <View style={{ gap: space.xxxs, flex: 1 }}>
          <AppText weight="medium" style={{ fontSize: fontSize.caption1, color: colors.onAccent }}>
            부산 맛집 5곳
          </AppText>
          <AppText style={{ fontSize: fontSize.caption2, color: "rgba(255,255,255,0.6)" }}>여행 브이로그</AppText>
        </View>
        <View style={{ alignItems: "center", gap: space.md }}>
          <Feather name="heart" size={18} color={colors.onAccent} />
          <Feather name="message-circle" size={18} color={colors.onAccent} />
          <View style={{ width: 36, height: 36, justifyContent: "center", alignItems: "center" }}>
            <TapRing size={36} />
            <Feather name={p.shareIcon} size={18} color={colors.onAccent} />
          </View>
        </View>
      </View>
    </View>
  );
}

function CopyLinkStep() {
  return (
    <View style={{ flex: 1, backgroundColor: "rgba(22,33,29,0.55)", justifyContent: "flex-end" }}>
      <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.sm, gap: space.sm }}>
        <View style={{ alignSelf: "center", width: 28, height: 4, borderRadius: radius.full, backgroundColor: colors.border }} />
        <AppText weight="medium" style={{ fontSize: fontSize.caption1, textAlign: "center" }}>
          공유
        </AppText>
        <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
          {[
            { icon: "map-pin" as const, label: "Trova", target: true },
            { icon: "link" as const, label: "링크 복사", target: false },
            { icon: "message-square" as const, label: "메시지", target: false },
          ].map((item) => (
            <View key={item.label} style={{ alignItems: "center", gap: space.xxs }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.full,
                  backgroundColor: item.target ? colors.accentBg : colors.bgMuted,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {item.target && <TapRing size={36} />}
                <Feather name={item.icon} size={16} color={item.target ? colors.accent : colors.inkMuted} />
              </View>
              <AppText style={{ fontSize: fontSize.caption2, color: item.target ? colors.accent : colors.inkMuted }}>{item.label}</AppText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// 3단계: 공유만 해 두면 분석이 끝난 뒤 일정까지 짜 둔다 — 로그인 전에 결과가 어떤 모습인지 미리 보여 준다.
function ResultStep({ platform }: { platform: DemoPlatform }) {
  const rows = [
    { time: "11:00", name: "해운대 돼지국밥", note: "· 오전에 가면 줄이 짧다" },
    { time: "13:00", name: "흰여울 문화마을", note: "· 바다 보이는 골목 산책" },
    { time: "15:30", name: "광안리 카페", note: "· 창가 자리에서 다리 보기" },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.sm, gap: space.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.xxs, padding: space.xs, borderRadius: radius.sm, backgroundColor: colors.accentBg }}>
        <Feather name="calendar" size={12} color={colors.accent} />
        <AppText weight="medium" style={{ fontSize: fontSize.caption2, color: colors.ink, flex: 1 }} numberOfLines={1}>
          일정이 준비됐어요
        </AppText>
        <AppText weight="medium" style={{ fontSize: fontSize.caption2, color: colors.accent }}>보기 ›</AppText>
      </View>
      <AppText weight="bold" style={{ fontSize: fontSize.footnote }}>
        부산 당일치기
      </AppText>
      {rows.map((r) => (
        <View key={r.name} style={{ flexDirection: "row", gap: space.xs }}>
          <AppText style={{ fontSize: fontSize.caption2, color: colors.inkMuted, width: 34 }}>{r.time}</AppText>
          <View style={{ flex: 1 }}>
            <AppText weight="medium" style={{ fontSize: fontSize.caption1 }} numberOfLines={1}>{r.name}</AppText>
            <AppText style={{ fontSize: fontSize.caption2, color: colors.inkMuted }} numberOfLines={1}>{r.note}</AppText>
          </View>
        </View>
      ))}
      <AppText style={{ fontSize: fontSize.caption2, color: colors.inkMuted, marginTop: "auto" }} numberOfLines={2}>
        {PLATFORM[platform].label} 영상에서 말한 내용이 장소마다 메모로 들어가요
      </AppText>
    </View>
  );
}

// 위쪽 단계 막대: 지금 단계 칸이 DEMO_STEP_MS 동안 채워진다(인스타 스토리 진행 막대처럼).
function StepBar({ index, active }: { index: number; active: number }) {
  const reducedMotion = useReducedMotion();
  const fill = useSharedValue(0);
  useEffect(() => {
    if (index < active) fill.value = 1;
    else if (index > active) fill.value = 0;
    else {
      fill.value = 0;
      fill.value = reducedMotion ? 1 : withTiming(1, { duration: DEMO_STEP_MS, easing: Easing.linear });
    }
  }, [active, fill, index, reducedMotion]);
  const style = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <View style={{ flex: 1, height: 4, borderRadius: radius.full, backgroundColor: colors.borderSubtle, overflow: "hidden" }}>
      <Animated.View style={[{ height: "100%", backgroundColor: colors.accent }, style]} />
    </View>
  );
}

export function DemoProgress({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: "row", gap: space.xxs, flex: 1 }}>
      {DEMO_STEPS.map((_, i) => (
        <StepBar key={i} index={i} active={step} />
      ))}
    </View>
  );
}

export function LinkPasteDemo({
  platform,
  step,
  onSelectStep,
}: {
  platform: DemoPlatform;
  step: number;
  onSelectStep: (step: number) => void;
}) {
  return (
    <View style={{ alignItems: "center", gap: space.lg }}>
      {/* 휴대폰 화면 미리보기 */}
      <View
        style={{
          width: 212,
          height: 340,
          borderRadius: 28 /* 토큰 예외: 휴대폰 모서리를 흉내 낸 그림 */,
          borderWidth: 6,
          borderColor: colors.media,
          overflow: "hidden",
          backgroundColor: colors.media,
        }}
      >
        <Animated.View key={`${platform}-${step}`} entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} style={{ flex: 1 }}>
          {step === 0 && <ShareStep platform={platform} />}
          {step === 1 && <CopyLinkStep />}
          {step === 2 && <ResultStep platform={platform} />}
        </Animated.View>
      </View>

      {/* 단계 이름: 누르면 그 단계로 간다. 큰 글자에서 한 줄에 안 들어가면 줄바꿈한다(가로로 넘치면 FitToSpace가 크기를 못 잰다) */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.xs }}>
        {DEMO_STEPS.map((label, i) => (
          <Pressable
            key={label}
            onPress={() => onSelectStep(i)}
            accessibilityRole="button"
            accessibilityState={{ selected: i === step }}
            style={{
              paddingVertical: space.xxs,
              paddingHorizontal: space.sm,
              borderRadius: radius.full,
              backgroundColor: i === step ? colors.accentBg : colors.bgMuted,
            }}
          >
            <AppText weight={i === step ? "medium" : "regular"} style={{ fontSize: fontSize.caption1, color: i === step ? colors.accent : colors.inkMuted }}>
              {i + 1}. {label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function PlatformTabs({ value, onChange }: { value: DemoPlatform; onChange: (p: DemoPlatform) => void }) {
  return (
    <View style={{ flexDirection: "row", padding: space.xxs, borderRadius: radius.full, backgroundColor: colors.bgMuted }}>
      {(Object.keys(PLATFORM) as DemoPlatform[]).map((key) => {
        const selected = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              flexDirection: "row",
              gap: space.xxs,
              paddingVertical: space.xs,
              borderRadius: radius.full,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: selected ? colors.bg : "transparent",
            }}
          >
            <Feather name={PLATFORM[key].icon} size={14} color={selected ? colors.ink : colors.inkMuted} />
            <AppText weight={selected ? "medium" : "regular"} style={{ fontSize: fontSize.footnote, color: selected ? colors.ink : colors.inkMuted }}>
              {PLATFORM[key].label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
