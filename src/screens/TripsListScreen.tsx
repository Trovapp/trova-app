import { FlatList, Platform, Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { listTrips } from "@/lib/api/trips";
import { colors } from "@/lib/theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "TripsList">;

const CARD_SHADOW = Platform.select({
  ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  android: { elevation: 2 },
});

export function TripsListScreen({ navigation }: Props) {
  const tripsQuery = useQuery({ queryKey: ["trips"], queryFn: listTrips });

  if (tripsQuery.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AppText>불러오는 중...</AppText>
      </View>
    );
  }

  const trips = tripsQuery.data ?? [];

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={trips}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <Pressable
          onPress={() => navigation.navigate("NewTrip")}
          style={{
            marginBottom: 4,
            height: 48,
            borderRadius: 12,
            backgroundColor: colors.accent,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <AppText weight="medium" style={{ color: "#fff" }}>
            새 여행 만들기
          </AppText>
        </Pressable>
      }
      ListEmptyComponent={<AppText style={{ textAlign: "center", marginTop: 32 }}>아직 만든 여행이 없어요.</AppText>}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => navigation.navigate("TripDetail", { id: item.id })}
          style={{
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.bg,
            ...CARD_SHADOW,
          }}
        >
          <AppText weight="medium">{item.title}</AppText>
          {item.startDate && (
            <AppText style={{ marginTop: 4, fontSize: 12, color: colors.inkMuted }}>
              {item.startDate} ~ {item.endDate}
            </AppText>
          )}
        </Pressable>
      )}
    />
  );
}
