import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { AppText } from "@/components/AppText";
import { buildKakaoMapHtml } from "@/lib/kakaoMapHtml";
import { colors } from "@/lib/theme";

const KAKAO_MAP_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_MAP_JS_KEY ?? "";

type Pin = { id: string; latitude: number; longitude: number; color?: string };

export function InlineMap({
  pins,
  height = 200,
  selectedId = null,
  showPath = true,
  fill = false,
}: {
  pins: Pin[];
  height?: number;
  // 있으면 해당 핀으로 지도를 이동시키고 하이라이트 링을 보여준다(웹 KakaoMap.tsx와 동일).
  selectedId?: string | null;
  // 방문 순서 동선을 표시할 필요가 없는 화면(예: 찜 폴더 지도)에서 false로 끈다.
  showPath?: boolean;
  // true면 고정 높이 대신 부모를 꽉 채운다(풀스크린 지도 화면용).
  fill?: boolean;
}) {
  const webviewRef = useRef<WebView>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // 호출부는 매 렌더마다 pins 배열을 새로 만든다(메모이제이션 없음). 배열 참조를
  // 의존성으로 쓰면 부모가 리렌더될 때마다(예: 검색어 한 글자 입력) WebView에
  // postMessage가 다시 나가 카카오 지도가 통째로 다시 만들어진다.
  // 그래서 참조가 아니라 "핀 내용"을 직렬화한 문자열을 의존성으로 쓴다 —
  // 내용이 실제로 바뀔 때만 새 메시지가 나간다.
  const pinsKey = JSON.stringify(
    pins.map((pin) => ({ id: pin.id, latitude: pin.latitude, longitude: pin.longitude, color: pin.color ?? null }))
  );
  const payload = JSON.stringify({ pins: pins.length > 0 ? JSON.parse(pinsKey) : [], selectedId, showPath });

  // pins가 []이 되면 아래 early return으로 WebView가 언마운트된다. 이 컴포넌트
  // 자체(그리고 isMapLoaded state)는 살아있으니, 이후 pins가 다시 채워지면
  // *완전히 새로운* WebView 인스턴스가 처음부터 다시 로드를 시작한다 — 하지만
  // isMapLoaded는 이미 true라서 이 effect의 의존성이 안 바뀌면 재발화하지 않고,
  // 새 WebView는 문서 로드가 끝나기 전에 이 effect가 보낸 메시지를 놓친다.
  // payloadRef로 "최신 페이로드"를 항상 들고 있다가 onLoadEnd에서 무조건
  // 다시 보내는 것으로 이 레이스를 근본적으로 막는다(아래 onLoadEnd 참고).
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  useEffect(() => {
    if (!isMapLoaded || mapError || pinsKey === "[]") return;
    webviewRef.current?.postMessage(payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMapLoaded, mapError, pinsKey, selectedId, showPath]);

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

  if (pins.length === 0) return null;

  const containerStyle = fill ? { flex: 1 as const } : { height, borderRadius: 12, overflow: "hidden" as const };

  if (!KAKAO_MAP_JS_KEY) {
    return (
      <View style={[containerStyle, { justifyContent: "center", alignItems: "center", backgroundColor: colors.bgMuted }]}>
        <AppText style={{ color: colors.inkMuted }}>지도 키가 설정되지 않았어요.</AppText>
      </View>
    );
  }

  if (mapError) {
    return (
      <View style={[containerStyle, { justifyContent: "center", alignItems: "center", backgroundColor: colors.bgMuted }]}>
        <AppText style={{ color: colors.inkMuted }}>{mapError}</AppText>
      </View>
    );
  }

  return (
    <WebView
      ref={webviewRef}
      source={{ html: buildKakaoMapHtml(KAKAO_MAP_JS_KEY), baseUrl: "https://localhost" }}
      style={containerStyle}
      onLoadEnd={() => {
        setIsMapLoaded(true);
        // isMapLoaded가 (컴포넌트 인스턴스가 살아있는 채로) 이미 true였다면
        // 위 setIsMapLoaded(true)는 상태 변화가 없어 리렌더/effect 재발화가
        // 일어나지 않는다. 새로 로드된 이 WebView가 확실히 최신 pins를
        // 받도록 여기서 직접 한 번 더 보낸다(문서 로드가 끝난 뒤라 드롭되지 않음).
        if (pins.length > 0) {
          webviewRef.current?.postMessage(payloadRef.current);
        }
      }}
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
