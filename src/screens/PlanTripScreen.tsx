import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { AppText, FONT, MAX_FONT_SCALE } from "@/components/AppText";
import { ErrorText } from "@/components/ErrorText";
import { PressableRow } from "@/components/PressableRow";
import { PressableScale } from "@/components/PressableScale";
import { QueryErrorView } from "@/components/QueryErrorView";
import { StaleNotice } from "@/components/StaleNotice";
import { SkeletonRow } from "@/components/Skeleton";
import { VideoThumb } from "@/components/VideoThumb";
import { haptics } from "@/lib/haptics";
import { toUserMessage } from "@/lib/api/client";
import { getPlaces, type Place } from "@/lib/api/places";
import {
  answerTripDraft,
  approveTripDraft,
  createTripDraft,
  getTripDraft,
  parsePlan,
  PLAN_MAX_VIDEOS,
  PLAN_MESSAGE_MAX_LENGTH,
  type DraftPlan,
  type TripDraft,
} from "@/lib/api/tripDrafts";
import { TRIP_TITLE_MAX_LENGTH } from "@/lib/api/trips";
import { formatDateLabel } from "@/lib/date";
import { categoryGroupInfo } from "@/lib/placeCategory";
import { describeSourceUrl } from "@/lib/shareUrl";
import { cleanVideoTitle } from "@/lib/videoTitle";
import { colors, fontSize, radius, space } from "@/lib/theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "PlanTrip">;

type Video = { jobId: number; title: string; placeCount: number; sourceUrl: string; platform: Place["sourcePlatform"] };

// 요청 문장을 처음부터 쓰기 어려워 자주 쓰는 기간을 칩으로 둔다 — 서버가 코드로 바로 읽는 표현이라 Gemini 호출도 없다.
const PERIOD_CHIPS = ["당일치기", "1박 2일", "2박 3일"];

// 저장한 장소를 영상 단위로 묶는다(영상 기록 탭과 같은 순서: 최신순).
function videosFrom(places: Place[]): Video[] {
  const map = new Map<number, Video>();
  for (const p of places) {
    const v = map.get(p.jobId);
    if (v) v.placeCount += 1;
    else
      map.set(p.jobId, {
        jobId: p.jobId,
        title: cleanVideoTitle(p.title) ?? describeSourceUrl(p.sourceUrl),
        placeCount: 1,
        sourceUrl: p.sourceUrl,
        platform: p.sourcePlatform,
      });
  }
  return Array.from(map.values());
}

function dayLabel(day: number, date: string | null): string {
  if (!date) return `${day}일차`;
  const [y, m, d] = date.split("-").map(Number);
  return `${day}일차 · ${formatDateLabel(new Date(y, m - 1, d))}`;
}

// 영상 여러 개 + "부산 1박 2일" → 서버 에이전트가 초안을 만들고(검증·수정 포함), 사용자가 보고 승인해야 여행이 된다(백엔드 #106).
// 한 화면 안에서 고르기 → 기다리기 → (지역이 멀면 질문) → 초안 확인·승인 순서로 바뀐다.
// route.params?.draftId: 홈 카드·영상 결과에서 이미 만들어진 자동 초안으로 들어올 때 — 고르기를 건너뛰고 바로 그 초안을 연다.
export function PlanTripScreen({ navigation, route }: Props) {
  const queryClient = useQueryClient();
  const placesQuery = useQuery({ queryKey: ["places"], queryFn: getPlaces });
  const videos = useMemo(() => videosFrom(placesQuery.data ?? []), [placesQuery.data]);

  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [draftId, setDraftId] = useState<number | null>(route.params?.draftId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 화면이 새로 뜨지 않고 재사용될 때(같은 라우트로 다시 navigate 등) route.params만 바뀔 수 있다 —
  // useState 초기값은 첫 렌더에만 적용돼서, draftId가 있는 다른 파라미터로 다시 들어오면 예전 초안이 그대로
  // 남아있었다. 파라미터로 draftId가 새로 왔을 때만 따라가고, 파라미터가 없는 진입(고르기 화면)은 그대로 둔다.
  useEffect(() => {
    if (route.params?.draftId != null && route.params.draftId !== draftId) {
      setDraftId(route.params.draftId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.draftId]);

  const draftQuery = useQuery({
    queryKey: ["tripDraft", draftId],
    queryFn: () => getTripDraft(draftId!),
    enabled: draftId != null,
    // 서버는 보통 몇 초 안에 끝난다(로컬 실측 2~5초) — 진행 중일 때만 1초마다 다시 묻는다.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "PENDING" || status === "PROCESSING" || status == null ? 1000 : false;
    },
  });

  function toggle(jobId: number) {
    haptics.selection();
    setSelected((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : prev.length >= PLAN_MAX_VIDEOS ? prev : [...prev, jobId],
    );
  }

  async function start() {
    if (busy || selected.length === 0 || !message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { draftId: id } = await createTripDraft(selected, message.trim());
      setDraftId(id);
    } catch (e) {
      setError(toUserMessage(e, "일정 만들기를 시작하지 못했어요. 잠시 후 다시 시도해주세요."));
    } finally {
      setBusy(false);
    }
  }

  async function answer(choice: "SPLIT" | "ONLY", jobIds?: number[]) {
    if (busy || draftId == null) return;
    setBusy(true);
    setError(null);
    try {
      await answerTripDraft(draftId, choice, jobIds);
      await draftQuery.refetch();
    } catch (e) {
      setError(toUserMessage(e, "답을 보내지 못했어요. 다시 시도해주세요."));
    } finally {
      setBusy(false);
    }
  }

  async function approve(title: string) {
    if (busy || draftId == null) return;
    setBusy(true);
    setError(null);
    try {
      const { tripId } = await approveTripDraft(draftId, title.trim() || null);
      haptics.success();
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      await queryClient.invalidateQueries({ queryKey: ["autoDrafts"] });
      navigation.replace("TripDetail", { id: tripId });
    } catch (e) {
      setError(toUserMessage(e, "여행으로 저장하지 못했어요. 다시 시도해주세요."));
      setBusy(false);
    }
  }

  // 조건을 바꿔 다시 짜기 — 고른 영상과 요청 문장은 그대로 둔다.
  function restart() {
    setDraftId(null);
    setError(null);
  }

  if (draftId != null) {
    const draft = draftQuery.data;
    if (draftQuery.isError && !draft) {
      return <QueryErrorView fullScreen message="일정 상태를 불러오지 못했어요. 네트워크 상태를 확인하고 다시 시도해주세요." onRetry={() => draftQuery.refetch()} />;
    }
    if (!draft || draft.status === "PENDING" || draft.status === "PROCESSING") {
      return <Working videoCount={selected.length} answered={draft?.answer != null} />;
    }
    if (draft.status === "NEEDS_INPUT") {
      return <Question draft={draft} videos={videos} busy={busy} error={error} onAnswer={answer} />;
    }
    if (draft.status === "FAILED") {
      return (
        <QueryErrorView
          fullScreen
          message={draft.errorMessage ?? "일정 초안을 만들지 못했어요."}
          onRetry={restart}
        />
      );
    }
    const plan = parsePlan(draft);
    if (!plan) {
      return <QueryErrorView fullScreen message="일정 초안을 읽지 못했어요." onRetry={restart} />;
    }
    return <Review plan={plan} busy={busy} error={error} onApprove={approve} onRestart={restart} />;
  }

  if (placesQuery.isLoading) {
    return (
      <View style={{ padding: space.md }}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </View>
    );
  }
  if (placesQuery.isError && !placesQuery.data) {
    return <QueryErrorView fullScreen message="저장한 영상을 불러오지 못했어요. 네트워크 상태를 확인하고 다시 시도해주세요." onRetry={() => placesQuery.refetch()} />;
  }
  if (videos.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: space.xl }}>
        <AppText style={{ textAlign: "center" }}>
          아직 분석한 영상이 없어요.{"\n"}
          <AppText style={{ color: colors.inkMuted }}>홈에서 여행 영상 링크를 넣으면 여기서 일정을 짤 수 있어요.</AppText>
        </AppText>
      </View>
    );
  }

  const canStart = selected.length > 0 && message.trim() !== "" && !busy;
  // 버튼이 꺼져 있을 때 무엇이 빠졌는지 알려준다(디자인 QA P3).
  const missing =
    message.trim() === "" && selected.length === 0
      ? "기간을 적고 영상을 골라 주세요."
      : message.trim() === ""
        ? "어떻게 다녀올지 적어 주세요. 예: 1박 2일"
        : selected.length === 0
          ? "일정을 짤 영상을 1개 이상 골라 주세요."
          : null;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.lg }} keyboardShouldPersistTaps="handled">
        {/* 받아 둔 영상 목록이 있으면 오류 화면 대신 한 줄만 알린다(디자인 QA E1). */}
        {placesQuery.isError && <StaleNotice onRetry={() => placesQuery.refetch()} />}
        <View style={{ gap: space.xs }}>
          <AppText weight="medium">어떻게 다녀올까요?</AppText>
          <TextInput
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            value={message}
            onChangeText={setMessage}
            placeholder="예: 11월 1일부터 부산 1박 2일"
            placeholderTextColor={colors.inkMuted}
            maxLength={PLAN_MESSAGE_MAX_LENGTH}
            returnKeyType="done"
            style={{
              height: 48,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingHorizontal: space.md,
              fontFamily: FONT.regular,
              color: colors.ink,
            }}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
            {PERIOD_CHIPS.map((chip) => {
              const on = message.includes(chip);
              return (
                <PressableScale
                  key={chip}
                  onPress={() => {
                    haptics.selection();
                    // 다른 기간 칩이 이미 있으면 바꾸고, 없으면 뒤에 붙인다.
                    const others = PERIOD_CHIPS.filter((c) => c !== chip);
                    const found = others.find((c) => message.includes(c));
                    setMessage(found ? message.replace(found, chip) : `${message.trim()} ${chip}`.trim());
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{
                    paddingVertical: space.xs,
                    paddingHorizontal: space.sm,
                    borderRadius: radius.full,
                    borderWidth: 1,
                    // 결과 화면 분류 칩(CategoryFilterChips)과 같은 선택 모양 — 앱 안의 칩이 한 가지로 보이게(디자인 QA P2).
                    borderColor: on ? colors.ink : colors.border,
                    backgroundColor: on ? colors.ink : colors.bg,
                  }}
                >
                  <AppText weight={on ? "medium" : "regular"} style={{ fontSize: fontSize.footnote, color: on ? colors.onAccent : colors.ink }}>
                    {chip}
                  </AppText>
                </PressableScale>
              );
            })}
          </View>
        </View>

        <View style={{ gap: space.xxs }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <AppText weight="medium">어떤 영상으로 짤까요?</AppText>
            <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted, fontVariant: ["tabular-nums"] }}>
              {selected.length}/{PLAN_MAX_VIDEOS}
            </AppText>
          </View>
          {videos.map((v, index) => {
            const on = selected.includes(v.jobId);
            const full = !on && selected.length >= PLAN_MAX_VIDEOS;
            return (
              <PressableRow
                key={v.jobId}
                onPress={() => toggle(v.jobId)}
                disabled={full}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: full }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.sm,
                  paddingVertical: space.sm,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: colors.borderSubtle,
                  opacity: full ? 0.4 : 1,
                }}
              >
                <Feather name={on ? "check-circle" : "circle"} size={22} color={on ? colors.accent : colors.border} />
                <VideoThumb sourceUrl={v.sourceUrl} platform={v.platform} size={48} />
                <View style={{ flex: 1, gap: space.xxxs }}>
                  <AppText numberOfLines={2}>{v.title}</AppText>
                  <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>장소 {v.placeCount}곳</AppText>
                </View>
              </PressableRow>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ padding: space.md, gap: space.xs, borderTopWidth: 1, borderTopColor: colors.borderSubtle, backgroundColor: colors.bg }}>
        {error && <ErrorText>{error}</ErrorText>}
        {!error && missing && !busy && (
          <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted, textAlign: "center" }}>{missing}</AppText>
        )}
        <PrimaryButton label={busy ? "시작하는 중..." : "일정 짜기"} disabled={!canStart} onPress={start} />
      </View>
    </KeyboardAvoidingView>
  );
}

function PrimaryButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={{
        height: 48,
        borderRadius: radius.md,
        backgroundColor: colors.accent,
        justifyContent: "center",
        alignItems: "center",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <AppText weight="medium" style={{ color: colors.onAccent }}>
        {label}
      </AppText>
    </PressableScale>
  );
}

function SecondaryButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={{
        height: 48,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: "center",
        alignItems: "center",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <AppText weight="medium">{label}</AppText>
    </PressableScale>
  );
}

function Working({ videoCount, answered }: { videoCount: number; answered: boolean }) {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: space.md, padding: space.xl }}>
      <ActivityIndicator color={colors.accent} />
      <AppText weight="medium" style={{ textAlign: "center" }}>
        {answered ? "답한 대로 다시 짜고 있어요" : `영상 ${videoCount}개의 장소로 일정을 짜고 있어요`}
      </AppText>
      <AppText style={{ color: colors.inkMuted, textAlign: "center", fontSize: fontSize.footnote }}>
        쉬는 날과 동선을 확인하는 중이에요.
      </AppText>
    </View>
  );
}

function Question({
  draft,
  videos,
  busy,
  error,
  onAnswer,
}: {
  draft: TripDraft;
  videos: Video[];
  busy: boolean;
  error: string | null;
  onAnswer: (choice: "SPLIT" | "ONLY", jobIds?: number[]) => void;
}) {
  const [pickOne, setPickOne] = useState(false);
  const [keep, setKeep] = useState<number[]>([]);
  const chosen = videos.filter((v) => draft.jobIds.includes(v.jobId));

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <AppText weight="medium" style={{ fontSize: fontSize.title3 }}>
          먼저 하나만 물어볼게요
        </AppText>
        <AppText style={{ color: colors.inkMuted }}>{draft.question}</AppText>
      </View>

      {!pickOne ? (
        <View style={{ gap: space.xs }}>
          <PrimaryButton label="지역별로 날을 나눠서 짜기" disabled={busy} onPress={() => onAnswer("SPLIT")} />
          <SecondaryButton label="한 지역만 고르기" disabled={busy} onPress={() => setPickOne(true)} />
        </View>
      ) : (
        <View style={{ gap: space.xs }}>
          <AppText weight="medium">어느 영상으로 짤까요?</AppText>
          {chosen.map((v, index) => {
            const on = keep.includes(v.jobId);
            return (
              <PressableRow
                key={v.jobId}
                onPress={() => {
                  haptics.selection();
                  setKeep((prev) => (on ? prev.filter((id) => id !== v.jobId) : [...prev, v.jobId]));
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.sm,
                  paddingVertical: space.sm,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: colors.borderSubtle,
                }}
              >
                <Feather name={on ? "check-circle" : "circle"} size={22} color={on ? colors.accent : colors.border} />
                <AppText numberOfLines={2} style={{ flex: 1 }}>
                  {v.title}
                </AppText>
              </PressableRow>
            );
          })}
          <PrimaryButton
            label="고른 영상으로 짜기"
            disabled={busy || keep.length === 0}
            onPress={() => onAnswer("ONLY", keep)}
          />
          <SecondaryButton label="뒤로" disabled={busy} onPress={() => setPickOne(false)} />
        </View>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </ScrollView>
  );
}

function Review({
  plan,
  busy,
  error,
  onApprove,
  onRestart,
}: {
  plan: DraftPlan;
  busy: boolean;
  error: string | null;
  onApprove: (title: string) => void;
  onRestart: () => void;
}) {
  const [title, setTitle] = useState("");
  const [showExcluded, setShowExcluded] = useState(false);
  const problems = plan.problems ?? [];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <AppText style={{ color: colors.inkMuted, fontSize: fontSize.footnote }}>
          초안이에요. 저장한 뒤에도 여행 화면에서 순서와 시간을 바꿀 수 있어요.
        </AppText>

        {problems.length > 0 && (
          <View style={{ gap: space.xxs, padding: space.sm, borderRadius: radius.md, backgroundColor: colors.bgMuted }}>
            <AppText weight="medium" style={{ fontSize: fontSize.footnote }}>
              확인해 주세요
            </AppText>
            {problems.map((p) => (
              <AppText key={p} style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>
                · {p}
              </AppText>
            ))}
          </View>
        )}

        {plan.days.map((day) => {
          // 숙소 안내는 마지막 날을 뺀 밤마다 "1일차 숙소: …" 형태로 온다 — 장소가 없는 날은 빠질 수 있어 일차로 찾는다.
          const lodging = plan.lodging.find((l) => l.startsWith(`${day.day}일차`));
          return (
          <View key={day.day} style={{ gap: space.xxs }}>
            <AppText weight="medium">{dayLabel(day.day, day.date)}</AppText>
            {day.items.length === 0 && (
              <AppText style={{ color: colors.inkMuted, fontSize: fontSize.footnote }}>이 날은 넣을 장소가 없었어요.</AppText>
            )}
            {day.items.map((item, index) => {
              const group = categoryGroupInfo(item.category);
              return (
                <View
                  key={item.placeId}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.sm,
                    paddingVertical: space.xs,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.borderSubtle,
                  }}
                >
                  {/* 시간만 다른 글꼴(IBM Plex Mono)로 보였다(2026-10-04 QA) — 여행 상세처럼 Pretendard + 고정폭 숫자로 맞춘다. */}
                  <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted, width: 44, fontVariant: ["tabular-nums"] }}>
                    {item.start}
                  </AppText>
                  <MaterialCommunityIcons name={group.icon} size={16} color={colors.inkMuted} accessibilityLabel={group.label} />
                  <AppText numberOfLines={2} style={{ flex: 1 }}>
                    {item.name}
                  </AppText>
                </View>
              );
            })}
            {lodging && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs, paddingTop: space.xxs }}>
                <Feather name="moon" size={14} color={colors.inkMuted} />
                <AppText style={{ flex: 1, fontSize: fontSize.footnote, color: colors.inkMuted }}>{lodging}</AppText>
              </View>
            )}
          </View>
          );
        })}

        {plan.excluded.length > 0 && (
          <View style={{ gap: space.xxs }}>
            <PressableRow
              onPress={() => setShowExcluded((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showExcluded }}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: space.xs }}
            >
              <AppText weight="medium">이번 일정에서 뺀 장소 {plan.excluded.length}곳</AppText>
              <Feather name={showExcluded ? "chevron-up" : "chevron-down"} size={18} color={colors.inkMuted} />
            </PressableRow>
            {showExcluded &&
              plan.excluded.map((e) => (
                <View key={e.placeId} style={{ gap: space.xxxs, paddingVertical: space.xxs }}>
                  <AppText>{e.name}</AppText>
                  <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>{e.reason}</AppText>
                </View>
              ))}
          </View>
        )}

        {plan.assumptions.length > 0 && (
          <View style={{ gap: space.xxxs }}>
            {plan.assumptions.map((a) => (
              <AppText key={a} style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>
                {a}
              </AppText>
            ))}
          </View>
        )}

        <TextInput
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          value={title}
          onChangeText={setTitle}
          placeholder="여행 이름 (비워두면 지역과 기간으로 지어요)"
          placeholderTextColor={colors.inkMuted}
          maxLength={TRIP_TITLE_MAX_LENGTH}
          style={{
            height: 48,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingHorizontal: space.md,
            fontFamily: FONT.regular,
            color: colors.ink,
          }}
        />
      </ScrollView>

      <View style={{ padding: space.md, gap: space.xs, borderTopWidth: 1, borderTopColor: colors.borderSubtle, backgroundColor: colors.bg }}>
        {error && <ErrorText>{error}</ErrorText>}
        <PrimaryButton label={busy ? "저장하는 중..." : "이 일정으로 여행 만들기"} disabled={busy} onPress={() => onApprove(title)} />
        <SecondaryButton label="조건 바꿔 다시 짜기" disabled={busy} onPress={onRestart} />
      </View>
    </KeyboardAvoidingView>
  );
}
