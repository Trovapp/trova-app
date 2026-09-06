import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, TextInput } from "react-native";
import { AppText } from "@/components/AppText";
import { createShare } from "@/lib/api/places";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

type Props = {
  navigation: NativeStackNavigationProp<Record<string, object | undefined>>;
};

export function HomeScreen({ navigation }: Props) {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!url.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await createShare(url.trim());
      navigation.navigate("PlacesList");
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
          borderColor: "#DEDED8",
          borderRadius: 12,
          paddingHorizontal: 16,
          fontFamily: "IBMPlexMono_400Regular",
        }}
      />
      <Pressable
        onPress={handleSubmit}
        disabled={submitting}
        style={{
          height: 48,
          borderRadius: 12,
          backgroundColor: "#FF6B4A",
          justifyContent: "center",
          alignItems: "center",
          opacity: submitting ? 0.6 : 1,
        }}
      >
        <AppText weight="medium" style={{ color: "#fff" }}>
          {submitting ? "추출 중..." : "장소 추출하기"}
        </AppText>
      </Pressable>
      {error && <AppText style={{ color: "#FF6B4A" }}>{error}</AppText>}
    </KeyboardAvoidingView>
  );
}
