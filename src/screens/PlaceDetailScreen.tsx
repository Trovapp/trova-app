import { Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { getPlace } from "@/lib/api/places";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "PlaceDetail">;

const CATEGORY_LABEL: Record<string, string> = {
  restaurant: "맛집",
  cafe: "카페",
  attraction: "명소",
  lodging: "숙소",
  shopping: "쇼핑",
  other: "기타",
};

function toCategoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category;
}

export function PlaceDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { data: place, isLoading } = useQuery({
    queryKey: ["place", id],
    queryFn: () => getPlace(id),
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AppText>불러오는 중...</AppText>
      </View>
    );
  }

  if (!place) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AppText>장소를 찾을 수 없어요.</AppText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 24, gap: 12 }}>
      <AppText weight="medium" style={{ fontSize: 22 }}>{place.placeName}</AppText>
      {place.address && <AppText style={{ color: "#8C8C86" }}>{place.address}</AppText>}
      {place.category && <AppText>{toCategoryLabel(place.category)}</AppText>}
      <Pressable
        onPress={() => navigation.navigate("Map", { id: place.id })}
        style={{ marginTop: 24, height: 48, borderRadius: 12, backgroundColor: "#FF6B4A", justifyContent: "center", alignItems: "center" }}
      >
        <AppText weight="medium" style={{ color: "#fff" }}>지도에서 보기</AppText>
      </Pressable>
    </View>
  );
}
