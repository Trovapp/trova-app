import { Linking, ScrollView, View } from "react-native";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import { LICENSE_NOTICES } from "@/lib/licenses";
import { colors, fontSize, radius, space } from "@/lib/theme";

export function LicensesScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.xxl }}>
      {LICENSE_NOTICES.map((notice) => (
        <View key={notice.name} style={{ gap: space.xs }}>
          <AppText weight="medium" style={{ fontSize: fontSize.callout }}>
            {notice.name}
          </AppText>
          <AppText style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>{notice.usage}</AppText>
          <PressableScale onPress={() => Linking.openURL(notice.url).catch(() => {})} hitSlop={8} style={{ alignSelf: "flex-start" }}>
            <AppText style={{ fontSize: fontSize.footnote, color: colors.accent }}>{notice.url}</AppText>
          </PressableScale>
          <View style={{ padding: space.md, borderRadius: radius.md, backgroundColor: colors.bgMuted }}>
            <AppText style={{ fontSize: fontSize.caption1, lineHeight: 19, color: colors.inkMuted }}>{notice.text}</AppText>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
