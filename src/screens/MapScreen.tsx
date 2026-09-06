import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { useQuery } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { getPlace } from "@/lib/api/places";
import { buildKakaoMapHtml } from "@/lib/kakaoMapHtml";
import type { RouteProp } from "@react-navigation/native";

type Props = {
  route: RouteProp<Record<string, { id: number }>, string>;
};

const KAKAO_MAP_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_MAP_JS_KEY ?? "";

export function MapScreen({ route }: Props) {
  const { id } = route.params;
  const webviewRef = useRef<WebView>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const { data: place, isLoading } = useQuery({
    queryKey: ["place", id],
    queryFn: () => getPlace(id),
  });

  useEffect(() => {
    if (!isMapLoaded || !place || place.latitude === null || place.longitude === null) return;
    const pins = [{ id: String(place.id), latitude: place.latitude, longitude: place.longitude }];
    webviewRef.current?.postMessage(JSON.stringify(pins));
  }, [isMapLoaded, place]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AppText>불러오는 중...</AppText>
      </View>
    );
  }

  if (!place || place.latitude === null || place.longitude === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AppText>이 장소는 좌표 정보가 없어요.</AppText>
      </View>
    );
  }

  return (
    <WebView
      ref={webviewRef}
      source={{ html: buildKakaoMapHtml(KAKAO_MAP_JS_KEY) }}
      style={{ flex: 1 }}
      onLoadEnd={() => setIsMapLoaded(true)}
    />
  );
}
