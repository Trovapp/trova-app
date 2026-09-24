import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
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

// 영상 기록/내 여행/저장 장소는 이제 하단 탭에 항상 떠 있어서(MainTabs) 홈에 따로
// 버튼을 두지 않는다 — 웹 홈 대시보드(HomeDashboard.tsx)처럼 인사말 + 링크 입력 +
// 최근 활동(찜한 장소 지도, 최근 여행) 위주로 가볍게 구성한다.
//
// 디자인(2026-09): 이 화면의 유일한 "진짜 할 일"은 링크를 붙여넣는 것 — 인사말과
// 입력을 하나의 히어로로 묶고(인사말만 bold), 최근 여행/찜한 장소는 카드+그림자
// 없이 구분선만 있는 가벼운 리스트로 낮춰서 위계를 명확히 한다. 모든 블록에
// 같은 테두리+radius+그림자를 반복하던 걸 걷어냈다.
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
      <ScrollView contentContainerStyle={{ padding: 24, gap: 28 }}>
        <View style={{ gap: 16 }}>
          <AppText weight="bold" style={{ fontSize: 26, lineHeight: 34 }}>
            {user?.nickname ?? "여행자"}님,{"\n"}어디로 떠나볼까요?
          </AppText>

          <View style={{ gap: 10 }}>
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="인스타그램 또는 유튜브 링크"
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                height: 52,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                paddingHorizontal: 18,
                fontFamily: "NotoSansKR_400Regular",
                color: colors.ink,
              }}
            />
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={{
                height: 52,
                borderRadius: 14,
                backgroundColor: colors.accent,
                justifyContent: "center",
                alignItems: "center",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              <AppText weight="medium" style={{ color: "#fff", fontSize: 16 }}>
                {submitting ? "추출 중..." : "장소 추출하기"}
              </AppText>
            </Pressable>
            {error && <AppText style={{ color: colors.accent, fontSize: 13 }}>{error}</AppText>}
          </View>
        </View>

        <WeatherAlertBanner
          onOpenAlternative={(tripId) => navigation.navigate("TripDetail", { id: tripId })}
        />

        {pins.length > 0 && (
          <View style={{ gap: 10 }}>
            <Pressable
              onPress={() => navigation.navigate("SavedPlaces")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
            >
              <AppText weight="medium">찜한 장소</AppText>
              <Feather name="chevron-right" size={18} color={colors.inkMuted} />
            </Pressable>
            <InlineMap pins={pins} height={160} showPath={false} />
          </View>
        )}

        {recentTrips.length > 0 && (
          <View>
            <AppText weight="medium" style={{ marginBottom: 10 }}>
              최근 여행
            </AppText>
            {recentTrips.map((trip, i) => (
              <Pressable
                key={trip.id}
                onPress={() => navigation.navigate("TripDetail", { id: trip.id })}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 14,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.borderSubtle,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText weight="medium" numberOfLines={1}>
                    {trip.title}
                  </AppText>
                  {trip.startDate && (
                    <AppText mono style={{ fontSize: 12, color: colors.inkMuted }}>
                      {trip.startDate} ~ {trip.endDate}
                    </AppText>
                  )}
                </View>
                <Feather name="chevron-right" size={18} color={colors.inkMuted} />
              </Pressable>
            ))}
          </View>
        )}

        <Pressable onPress={() => logout()} style={{ alignItems: "center" }}>
          <AppText style={{ color: colors.inkMuted, fontSize: 13 }}>로그아웃</AppText>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
