import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useQuery } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { getPlace } from "@/lib/api/places";
import { buildKakaoMapHtml } from "@/lib/kakaoMapHtml";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Map">;

const KAKAO_MAP_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_MAP_JS_KEY ?? "";

export function MapScreen({ route }: Props) {
  const { id } = route.params;
  const webviewRef = useRef<WebView>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const { data: place, isLoading } = useQuery({
    queryKey: ["place", id],
    queryFn: () => getPlace(id),
  });

  useEffect(() => {
    if (!isMapLoaded || mapError || !place || place.latitude === null || place.longitude === null) return;
    const pins = [{ id: String(place.id), latitude: place.latitude, longitude: place.longitude }];
    webviewRef.current?.postMessage(JSON.stringify(pins));
  }, [isMapLoaded, mapError, place]);

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data?.type === "sdk-load-error" || data?.type === "render-error") {
        setMapError("지도를 불러오지 못했어요.");
      }
    } catch {
      // 무시 — 지도 쪽에서 보낸 다른 형식의 메시지일 수 있음
    }
  }

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

  if (!KAKAO_MAP_JS_KEY) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AppText>지도 키가 설정되지 않았어요.</AppText>
      </View>
    );
  }

  if (mapError) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AppText>{mapError}</AppText>
      </View>
    );
  }

  return (
    <WebView
      ref={webviewRef}
      source={{ html: buildKakaoMapHtml(KAKAO_MAP_JS_KEY), baseUrl: "https://localhost" }}
      style={{ flex: 1 }}
      onLoadEnd={() => setIsMapLoaded(true)}
      onMessage={handleMessage}
      onError={() => {
        setIsMapLoaded(false);
        setMapError("지도를 불러오지 못했어요.");
      }}
      onHttpError={() => {
        setIsMapLoaded(false);
        setMapError("지도를 불러오지 못했어요.");
      }}
    />
  );
}
