import { Linking, ScrollView, View } from "react-native";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import { LICENSE_NOTICES } from "@/lib/licenses";
import { colors } from "@/lib/theme";

export function LicensesScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 28 }}>
      {LICENSE_NOTICES.map((notice) => (
        <View key={notice.name} style={{ gap: 8 }}>
          <AppText weight="medium" style={{ fontSize: 16 }}>
            {notice.name}
          </AppText>
          <AppText style={{ fontSize: 13, color: colors.inkMuted }}>{notice.usage}</AppText>
          <PressableScale onPress={() => Linking.openURL(notice.url).catch(() => {})} hitSlop={8} style={{ alignSelf: "flex-start" }}>
            <AppText style={{ fontSize: 13, color: colors.accent }}>{notice.url}</AppText>
          </PressableScale>
          <View style={{ padding: 14, borderRadius: 12, backgroundColor: colors.bgMuted }}>
            <AppText style={{ fontSize: 12, lineHeight: 19, color: colors.inkMuted }}>{notice.text}</AppText>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
