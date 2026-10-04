import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppText } from "@/components/AppText";
import { ErrorText } from "@/components/ErrorText";
import { PressableScale } from "@/components/PressableScale";
import { ProgressBar } from "@/components/ProgressBar";
import { QueryErrorView } from "@/components/QueryErrorView";
import { FEATURE_LABELS, getBillingStatus, recordAppleTransaction, type BillingStatus, type MeteredFeature } from "@/lib/api/billing";
import { toUserMessage } from "@/lib/api/client";
import { haptics } from "@/lib/haptics";
import { iap, TRAVEL_PASS_FALLBACK_PRICE, TRAVEL_PASS_PRODUCT_ID } from "@/lib/iap";
import { TERMS_URL } from "@/lib/legal";
import { colors, fontSize, radius, space } from "@/lib/theme";
import type { RootStackParamList } from "@/navigation/types";

// 여행 패스 구매 페이지(2026-10-05, BM: 모으기는 무료, 계획·AI는 여행 패스).
// 여행은 1년에 몇 번 몰아서 준비하는 일이라 자동 갱신 구독 대신 "여행 한 번에 한 장"인 30일 패스를 판다.
const FEATURES: MeteredFeature[] = ["ANALYSIS", "DRAFT", "ASSIST"];

// 비교표 — 서버 한도(PlanService)와 같은 값이다. 서버가 바뀌면 같이 고친다.
const COMPARE: { feature: MeteredFeature; free: string; pass: string }[] = [
  { feature: "ANALYSIS", free: "월 20개", pass: "월 100개" },
  { feature: "DRAFT", free: "월 1회", pass: "하루 10회" },
  { feature: "ASSIST", free: "월 5회", pass: "하루 30회" },
];

type Props = NativeStackScreenProps<RootStackParamList, "Pass">;

function formatUntil(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일까지`;
}

function periodLabel(period: "MONTH" | "DAY"): string {
  return period === "MONTH" ? "이번 달" : "오늘";
}

export function PassScreen({ route }: Props) {
  const insets = useSafeAreaInsets();
  const statusQuery = useQuery({ queryKey: ["billingStatus"], queryFn: getBillingStatus });
  const status = statusQuery.data;
  const cameFrom = route.params?.feature;

  if (statusQuery.isPending) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.inkMuted} />
      </View>
    );
  }
  if (statusQuery.isError || !status) {
    return <QueryErrorView fullScreen message="여행 패스 정보를 불러오지 못했어요." onRetry={() => statusQuery.refetch()} />;
  }

  const onPass = status.plan === "PASS";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingBottom: space.xxxl }}>
        <View style={{ gap: space.xs }}>
          <AppText weight="bold" style={{ fontSize: fontSize.title2 }}>
            여행 한 번, 패스 한 장
          </AppText>
          <AppText style={{ color: colors.inkMuted }}>
            30일 동안 AI 일정 초안과 비서·대안 찾기를 넉넉하게 쓸 수 있어요. 영상 저장과 지도 정리는 언제나 무료예요.
          </AppText>
        </View>

        {cameFrom && !onPass && (
          <View style={{ flexDirection: "row", gap: space.sm, padding: space.md, borderRadius: radius.md, borderCurve: "continuous", backgroundColor: colors.accentBg }}>
            <Feather name="info" size={16} color={colors.accent} style={{ marginTop: space.xxxs }} />
            <AppText style={{ flex: 1, color: colors.ink }}>
              이번 달 무료 {FEATURE_LABELS[cameFrom]} 횟수를 다 썼어요. 여행 패스로 이어서 쓸 수 있어요.
            </AppText>
          </View>
        )}

        <View style={{ gap: space.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
            <AppText weight="medium" style={{ fontSize: fontSize.callout }}>
              {onPass ? "여행 패스 사용 중" : "무료 이용 중"}
            </AppText>
            {onPass && status.passExpiresAt && (
              <AppText style={{ color: colors.accent, fontSize: fontSize.footnote }}>{formatUntil(status.passExpiresAt)}</AppText>
            )}
          </View>
          {FEATURES.map((f) => {
            const u = status.usage[f];
            const percent = u.limit > 0 ? Math.min(100, (u.used / u.limit) * 100) : 0;
            return (
              <View key={f} style={{ gap: space.xxs }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <AppText style={{ fontSize: fontSize.subheadline }}>{FEATURE_LABELS[f]}</AppText>
                  <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted, fontVariant: ["tabular-nums"] }}>
                    {periodLabel(u.period)} {u.used} / {u.limit}
                  </AppText>
                </View>
                <ProgressBar percent={percent} height={4} />
              </View>
            );
          })}
          {!status.enforced && (
            <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>
              지금은 결제 준비 중이라 횟수를 넘어도 막지 않아요.
            </AppText>
          )}
        </View>

        <View style={{ borderRadius: radius.md, borderCurve: "continuous", borderWidth: 1, borderColor: colors.borderSubtle, overflow: "hidden" }}>
          <View style={{ flexDirection: "row", backgroundColor: colors.bgMuted, paddingVertical: space.sm, paddingHorizontal: space.md }}>
            <AppText style={{ flex: 1.4, fontSize: fontSize.footnote, color: colors.inkMuted }}> </AppText>
            <AppText weight="medium" style={{ flex: 1, fontSize: fontSize.footnote, color: colors.inkMuted }}>
              무료
            </AppText>
            <AppText weight="medium" style={{ flex: 1, fontSize: fontSize.footnote, color: colors.accent }}>
              여행 패스
            </AppText>
          </View>
          {COMPARE.map((row) => (
            <View
              key={row.feature}
              style={{ flexDirection: "row", paddingVertical: space.md, paddingHorizontal: space.md, borderTopWidth: 1, borderTopColor: colors.borderSubtle }}
            >
              <AppText style={{ flex: 1.4, fontSize: fontSize.subheadline }}>{FEATURE_LABELS[row.feature]}</AppText>
              <AppText style={{ flex: 1, fontSize: fontSize.subheadline, color: colors.inkMuted }}>{row.free}</AppText>
              <AppText weight="medium" style={{ flex: 1, fontSize: fontSize.subheadline }}>
                {row.pass}
              </AppText>
            </View>
          ))}
          <View style={{ flexDirection: "row", paddingVertical: space.md, paddingHorizontal: space.md, borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
            <AppText style={{ flex: 1.4, fontSize: fontSize.subheadline }}>지도·찜·여행 만들기</AppText>
            <AppText style={{ flex: 2, fontSize: fontSize.subheadline, color: colors.inkMuted }}>둘 다 무제한</AppText>
          </View>
        </View>

        <View style={{ gap: space.xs }}>
          <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>
            · 자동으로 갱신되지 않아요. 쓰는 중에 또 사면 끝나는 날부터 30일이 이어져요.
          </AppText>
          <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>
            · 결제는 Apple ID로 진행되고, 환불은 Apple에 요청할 수 있어요.
          </AppText>
          <PressableScale onPress={() => WebBrowser.openBrowserAsync(TERMS_URL).catch(() => {})} accessibilityRole="link" style={{ alignSelf: "flex-start" }}>
            <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted, textDecorationLine: "underline" }}>이용약관</AppText>
          </PressableScale>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: insets.bottom + space.md, borderTopWidth: 1, borderTopColor: colors.borderSubtle, backgroundColor: colors.bg }}>
        {iap ? <PurchaseButton status={status} /> : <UnavailableButton />}
      </View>
    </View>
  );
}

function UnavailableButton() {
  return (
    <View style={{ height: 52, borderRadius: radius.md, borderCurve: "continuous", backgroundColor: colors.bgMuted, justifyContent: "center", alignItems: "center" }}>
      <AppText style={{ color: colors.inkMuted }}>이 버전의 앱에서는 아직 결제할 수 없어요</AppText>
    </View>
  );
}

// iap가 있을 때만 그린다(useIAP는 네이티브 모듈이 필요). 구매 → 서버 기록 → 거래 마무리 순서 —
// 서버 기록이 실패하면 거래를 마무리하지 않아, 앱을 다시 열 때 StoreKit이 거래를 다시 넘겨준다(서버는 같은 거래를 한 장만 만든다).
function PurchaseButton({ status }: { status: BillingStatus }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<"buy" | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { connected, products, fetchProducts, requestPurchase, finishTransaction, restorePurchases, availablePurchases } = iap!.useIAP({
    onPurchaseSuccess: async (purchase) => {
      try {
        if (!purchase.purchaseToken) throw new Error("결제 정보를 받지 못했어요.");
        await recordAppleTransaction(purchase.purchaseToken);
        await finishTransaction({ purchase, isConsumable: false });
        haptics.success();
        await queryClient.invalidateQueries({ queryKey: ["billingStatus"] });
        Alert.alert("여행 패스를 시작했어요", "30일 동안 AI 일정과 비서를 넉넉하게 쓸 수 있어요.");
      } catch (e) {
        setError(toUserMessage(e, "결제는 됐지만 패스를 붙이지 못했어요. 앱을 다시 열면 다시 시도해요."));
      } finally {
        setBusy(null);
      }
    },
    onPurchaseError: (e) => {
      setBusy(null);
      if (iap!.isUserCancelledError(e)) return;
      setError("결제를 마치지 못했어요. 잠시 후 다시 시도해주세요.");
    },
  });

  useEffect(() => {
    if (connected) fetchProducts({ skus: [TRAVEL_PASS_PRODUCT_ID], type: "in-app" }).catch(() => {});
  }, [connected, fetchProducts]);

  // "이미 산 패스 불러오기": 다른 기기·재설치 후, 또는 서버 기록이 끊겼을 때 거래를 다시 보낸다.
  useEffect(() => {
    if (busy !== "restore") return;
    (async () => {
      try {
        const passes = availablePurchases.filter((p) => p.productId === TRAVEL_PASS_PRODUCT_ID && p.purchaseToken);
        for (const p of passes) await recordAppleTransaction(p.purchaseToken!);
        await queryClient.invalidateQueries({ queryKey: ["billingStatus"] });
        Alert.alert(passes.length > 0 ? "패스를 불러왔어요" : "불러올 패스가 없어요");
      } catch (e) {
        setError(toUserMessage(e, "패스를 불러오지 못했어요."));
      } finally {
        setBusy(null);
      }
    })();
    // availablePurchases가 채워진 뒤 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availablePurchases]);

  const price = products.find((p) => p.id === TRAVEL_PASS_PRODUCT_ID)?.displayPrice ?? TRAVEL_PASS_FALLBACK_PRICE;
  const onPass = status.plan === "PASS";

  async function buy() {
    setError(null);
    setBusy("buy");
    try {
      await requestPurchase({
        request: { apple: { sku: TRAVEL_PASS_PRODUCT_ID, appAccountToken: status.appAccountToken } },
        type: "in-app",
      });
    } catch {
      // 결과는 onPurchaseSuccess / onPurchaseError로 온다.
    }
  }

  async function restore() {
    setError(null);
    setBusy("restore");
    try {
      await restorePurchases();
    } catch {
      setBusy(null);
      setError("패스를 불러오지 못했어요.");
    }
  }

  return (
    <View style={{ gap: space.sm }}>
      {error && <ErrorText>{error}</ErrorText>}
      <PressableScale
        onPress={buy}
        disabled={busy !== null || !connected}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy !== null || !connected, busy: busy === "buy" }}
        style={{
          height: 52,
          borderRadius: radius.md,
          borderCurve: "continuous",
          backgroundColor: colors.accent,
          justifyContent: "center",
          alignItems: "center",
          opacity: busy !== null || !connected ? 0.6 : 1,
        }}
      >
        <AppText weight="medium" style={{ color: colors.onAccent, fontSize: fontSize.callout }}>
          {busy === "buy" ? "결제하는 중..." : onPass ? `30일 더 연장하기 · ${price}` : `${price}으로 30일 쓰기`}
        </AppText>
      </PressableScale>
      <PressableScale onPress={restore} disabled={busy !== null} style={{ alignSelf: "center", padding: space.xs }}>
        <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>
          {busy === "restore" ? "불러오는 중..." : "이미 산 패스 불러오기"}
        </AppText>
      </PressableScale>
    </View>
  );
}
