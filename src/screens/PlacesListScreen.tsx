import { useEffect, useRef } from "react";
import { FlatList, Platform, Pressable, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { getPendingJobs, getPlaces } from "@/lib/api/places";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "PlacesList">;

const CARD_SHADOW = Platform.select({
  ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  android: { elevation: 2 },
});

export function PlacesListScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const placesQuery = useQuery({ queryKey: ["places"], queryFn: getPlaces });
  const pendingQuery = useQuery({
    queryKey: ["pendingJobs"],
    queryFn: getPendingJobs,
    refetchInterval: (query) => ((query.state.data?.length ?? 0) > 0 ? 5000 : false),
  });

  const previousPendingCountRef = useRef<number | null>(null);
  useEffect(() => {
    const currentCount = pendingQuery.data?.length ?? 0;
    const previousCount = previousPendingCountRef.current;
    if (previousCount !== null && previousCount > 0 && currentCount === 0) {
      queryClient.invalidateQueries({ queryKey: ["places"] });
    }
    previousPendingCountRef.current = currentCount;
  }, [pendingQuery.data, queryClient]);

  if (placesQuery.isLoading || pendingQuery.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AppText>불러오는 중...</AppText>
      </View>
    );
  }

  const places = placesQuery.data ?? [];
  const pendingCount = pendingQuery.data?.length ?? 0;

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={places}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        pendingCount > 0 ? (
          <AppText style={{ marginBottom: 12, color: "#8C8C86" }}>
            처리 중인 링크 {pendingCount}개
          </AppText>
        ) : null
      }
      ListEmptyComponent={<AppText style={{ textAlign: "center", marginTop: 32 }}>아직 저장한 장소가 없어요.</AppText>}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => navigation.navigate("PlaceDetail", { id: item.id })}
          style={{
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#DEDED8",
            backgroundColor: "#fff",
            ...CARD_SHADOW,
          }}
        >
          <AppText weight="medium">{item.placeName}</AppText>
          {item.address && <AppText style={{ marginTop: 4, fontSize: 12, color: "#8C8C86" }}>{item.address}</AppText>}
        </Pressable>
      )}
    />
  );
}
