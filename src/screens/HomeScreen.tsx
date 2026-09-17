import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { InlineMap } from "@/components/InlineMap";
import { WeatherAlertBanner } from "@/components/WeatherAlertBanner";
import { createShare } from "@/lib/api/places";
import { listBookmarks } from "@/lib/api/bookmarks";
import { listTrips } from "@/lib/api/trips";
import { useAuth } from "@/lib/auth/AuthContext";
import { colors } from "@/lib/theme";
import type { MainTabScreenProps } from "@/navigation/types";

type Props = MainTabScreenProps<"Home">;

const CARD_SHADOW = Platform.select({
  ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  android: { elevation: 2 },
});

// 영상 기록/내 여행/저장 장소는 이제 하단 탭에 항상 떠 있어서(MainTabs) 홈에 따로
// 버튼을 두지 않는다 — 웹 홈 대시보드(HomeDashboard.tsx)처럼 인사말 + 링크 입력 +
// 최근 활동(찜한 장소 지도, 최근 여행) 위주로 가볍게 구성한다.
export function HomeScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bookmarksQuery = useQuery({ queryKey: ["bookmarks"], queryFn: listBookmarks });
  const tripsQuery = useQuery({ queryKey: ["trips"], queryFn: listTrips });

  const pins = (bookmarksQuery.data ?? [])
    .filter((b) => b.latitude !== null && b.longitude !== null)
    .map((b) => ({ id: String(b.id), latitude: b.latitude as number, longitude: b.longitude as number }));
  const recentTrips = (tripsQuery.data ?? []).slice(0, 3);

  async function handleSubmit() {
    if (!url.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { jobId } = await createShare(url.trim());
      navigation.navigate("Processing", { jobId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
        <AppText weight="medium" style={{ fontSize: 20 }}>
          {user?.nickname ?? "여행자"}님, 어디로 떠나볼까요?
        </AppText>

        <WeatherAlertBanner
          onOpenAlternative={(tripId) => navigation.navigate("TripDetail", { id: tripId })}
        />

        <View style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, gap: 12 }}>
          <AppText weight="medium">여행 영상 링크를 붙여넣으세요</AppText>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="인스타그램 또는 유튜브 링크"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              height: 48,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingHorizontal: 16,
              fontFamily: "NotoSansKR_400Regular",
              color: colors.ink,
            }}
          />
          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={{
              height: 48,
              borderRadius: 12,
              backgroundColor: colors.accent,
              justifyContent: "center",
              alignItems: "center",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            <AppText weight="medium" style={{ color: "#fff" }}>
              {submitting ? "추출 중..." : "장소 추출하기"}
            </AppText>
          </Pressable>
          {error && <AppText style={{ color: colors.accent }}>{error}</AppText>}
        </View>

        {pins.length > 0 && (
          <View style={{ gap: 8 }}>
            <Pressable onPress={() => navigation.navigate("SavedPlaces")}>
              <AppText weight="medium">찜한 장소 지도 →</AppText>
            </Pressable>
            <InlineMap pins={pins} height={160} showPath={false} />
          </View>
        )}

        {recentTrips.length > 0 && (
          <View style={{ gap: 8 }}>
            <AppText weight="medium">최근 여행</AppText>
            {recentTrips.map((trip) => (
              <Pressable
                key={trip.id}
                onPress={() => navigation.navigate("TripDetail", { id: trip.id })}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.bg,
                  ...CARD_SHADOW,
                }}
              >
                <AppText weight="medium" numberOfLines={1}>
                  {trip.title}
                </AppText>
                {trip.startDate && (
                  <AppText style={{ marginTop: 2, fontSize: 12, color: colors.inkMuted }}>
                    {trip.startDate} ~ {trip.endDate}
                  </AppText>
                )}
              </Pressable>
            ))}
          </View>
        )}

        <Pressable onPress={() => logout()} style={{ marginTop: 4, alignItems: "center" }}>
          <AppText style={{ color: colors.inkMuted }}>로그아웃</AppText>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
