import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, TextInput } from "react-native";
import { AppText } from "@/components/AppText";
import { createShare } from "@/lib/api/places";
import { useAuth } from "@/lib/auth/AuthContext";
import { colors } from "@/lib/theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, padding: 24, justifyContent: "center", gap: 12 }}
    >
      <AppText weight="medium" style={{ fontSize: 20, marginBottom: 8 }}>
        여행 영상 링크를 붙여넣으세요
      </AppText>
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
      <Pressable
        onPress={() => navigation.navigate("PlacesList")}
        style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, justifyContent: "center", alignItems: "center" }}
      >
        <AppText weight="medium">영상 기록 보기</AppText>
      </Pressable>
      <Pressable
        onPress={() => navigation.navigate("SavedPlaces")}
        style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, justifyContent: "center", alignItems: "center" }}
      >
        <AppText weight="medium">저장 장소 보기</AppText>
      </Pressable>
      <Pressable
        onPress={() => navigation.navigate("TripsList")}
        style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, justifyContent: "center", alignItems: "center" }}
      >
        <AppText weight="medium">내 여행 보기</AppText>
      </Pressable>
      <Pressable onPress={() => logout()} style={{ marginTop: 12, alignItems: "center" }}>
        <AppText style={{ color: colors.inkMuted }}>로그아웃</AppText>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
