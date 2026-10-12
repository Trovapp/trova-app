// 웹(PWA)용 지도 — 앱의 WebView 대신 iframe(srcdoc)에 같은 카카오맵 HTML을 띄운다(ADR 0013).
// 카카오 개발자 콘솔에 웹 도메인을 등록해야 지도가 뜬다.
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { buildWebKakaoMapHtml } from "@/lib/kakaoMapHtml";
import { colors, radius } from "@/lib/theme";

const KAKAO_MAP_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_MAP_JS_KEY ?? "";

type Pin = { id: string; latitude: number; longitude: number; color?: string; label?: string };

export function InlineMap({
  pins,
  height = 200,
  selectedId = null,
  showPath = true,
  fill = false,
  bottomInsetRatio = 0,
  numbered = true,
}: {
  pins: Pin[];
  height?: number;
  // 있으면 해당 핀으로 지도를 이동시키고 하이라이트 링을 보여준다(웹 KakaoMap.tsx와 동일).
  selectedId?: string | null;
  // 방문 순서 동선을 표시할 필요가 없는 화면(예: 찜 폴더 지도)에서 false로 끈다.
  showPath?: boolean;
  // true면 고정 높이 대신 부모를 꽉 채운다(풀스크린 지도 화면용).
  fill?: boolean;
  // 지도 아래쪽이 바텀시트 등으로 가려지는 비율(0~1). 핀을 가려지지 않는 영역 안에 배치한다.
  bottomInsetRatio?: number;
  // false면 핀에 번호 없이 작은 색 점만 그린다(순서가 없는 찜한 장소 전체 보기).
  numbered?: boolean;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // 호출부는 매 렌더마다 pins 배열을 새로 만든다(메모이제이션 없음). 배열 참조를
  // 의존성으로 쓰면 부모가 리렌더될 때마다(예: 검색어 한 글자 입력) WebView에
  // postMessage가 다시 나가 카카오 지도가 통째로 다시 만들어진다.
  // 그래서 참조가 아니라 "핀 내용"을 직렬화한 문자열을 의존성으로 쓴다 —
  // 내용이 실제로 바뀔 때만 새 메시지가 나간다.
  const pinsKey = JSON.stringify(
    pins.map((pin) => ({ id: pin.id, latitude: pin.latitude, longitude: pin.longitude, color: pin.color ?? null, label: pin.label ?? null }))
  );
  const payload = JSON.stringify({ pins: pins.length > 0 ? JSON.parse(pinsKey) : [], selectedId, showPath, bottomInsetRatio, numbered });

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
    // 풀스크린(fill) 지도는 핀이 비어도 지도를 유지하므로 빈 목록도 보내서 이전 핀을 지우게 한다.
    if (!isMapLoaded || mapError || (pinsKey === "[]" && !fill)) return;
    frameRef.current?.contentWindow?.postMessage(payload, "*");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMapLoaded, mapError, pinsKey, selectedId, showPath, fill, numbered]);

  // 지도(iframe)가 보내는 오류 알림. 이 지도의 창에서 온 메시지만 본다.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow || typeof event.data !== "string") return;
      handleMessage(event.data);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function handleMessage(raw: string) {
    try {
      const data = JSON.parse(raw);
      if (data?.type === "sdk-load-error" || data?.type === "render-error") {
        setMapError("지도를 불러오지 못했어요.");
      }
    } catch {
      // 무시 — 지도 쪽에서 보낸 다른 형식의 메시지일 수 있음
    }
  }

  // 작은 인라인 지도는 핀이 없으면 통째로 숨긴다. 풀스크린 지도는 화면의 배경이라
  // 숨기면 빈 영역만 남으므로(예: 빈 찜 폴더) 지도를 그대로 두고 핀만 비운다.
  if (pins.length === 0 && !fill) return null;

  const containerStyle = fill ? { flex: 1 as const } : { height, borderRadius: radius.md, overflow: "hidden" as const };

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
    <View style={containerStyle}>
      <iframe
        ref={frameRef}
        title="지도"
        srcDoc={buildWebKakaoMapHtml(KAKAO_MAP_JS_KEY)}
        style={{ border: 0, width: "100%", height: "100%" }}
        onLoad={() => {
          setIsMapLoaded(true);
          // 앱(WebView)과 같은 이유로, 새로 로드된 지도가 최신 핀을 확실히 받게 한 번 더 보낸다.
          if (pins.length > 0 || fill) {
            frameRef.current?.contentWindow?.postMessage(payloadRef.current, "*");
          }
        }}
      />
    </View>
  );
}
