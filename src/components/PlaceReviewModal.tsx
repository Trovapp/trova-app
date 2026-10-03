import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { PressableScale } from "@/components/PressableScale";
import { SheetCloseButton } from "@/components/SheetCloseButton";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { Emoji } from "@/components/Emoji";
import { InlineMap } from "@/components/InlineMap";
import { ProgressBar } from "@/components/ProgressBar";
import { RatingBadge } from "@/components/RatingBadge";
import { getPlaceDetails } from "@/lib/api/recommendations";
import { getTripPlaceDetails } from "@/lib/api/trips";
import { categoryLabel } from "@/lib/placeCategory";
import { kakaoMapUrl, openExternal, phoneUrl } from "@/lib/placeLinks";
import { formatCount } from "@/lib/number";
import { colors, fontSize, radius, space } from "@/lib/theme";

const SHEET_SNAP_POINTS = ["32%", "60%"];

// 리뷰 요약 생성은 단일 요청(검색 매칭 + Gemini 생성)이라 백엔드가 실제 단계별
// 진행률을 알려주지 않는다. 그래서 "체감 진행률"만 흉내낸다 — 예상 소요시간(6초)
// 동안 92%까지 서서히 채우고, 실제 응답이 오면(로딩 종료) 그 즉시 콘텐츠로 바뀐다.
const EXPECTED_LOAD_MS = 6000;
const SIMULATED_CAP_PERCENT = 92;
// 92%에서 이만큼 더 지나면 "느린 이유" 안내를 보여준다 — 백엔드가 무료 티어 rate
// limit에 걸려 지수 백오프로 재시도 중일 때(실측 최대 53초, docs 없음·2026-09-24
// api_call_logs 조회로 확인) 아무 설명 없이 멈춰 보이는 걸 막는다.
const SLOW_NOTICE_DELAY_MS = 4000;

function HighlightedText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <AppText style={{ fontSize: fontSize.footnote, lineHeight: 19 }}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <AppText key={i} weight="medium" style={{ backgroundColor: colors.accentBg }}>
            {part}
          </AppText>
        ) : (
          part
        )
      )}
    </AppText>
  );
}

// 장소 상세/리뷰 요약 콘텐츠만 렌더링한다(스크롤 컨테이너는 호출부 책임) — 그래야
// 일반 ScrollView 안(PlaceReviewModal)과 BottomSheetScrollView 안(지도 화면들처럼
// 뒤 지도가 계속 터치되어야 하는 곳)에서 똑같이 재사용할 수 있다.
// 영상 속 장소 상세(SavedPlaceInfoSheet)와 같은 옅은 채움 버튼.
const linkButtonStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: space.xs,
  paddingVertical: space.sm,
  paddingHorizontal: space.md,
  borderRadius: radius.md,
  backgroundColor: colors.borderSubtle,
} as const;

export function PlaceReviewContent({
  placeId = null,
  tripPlaceId = null,
  showMiniMap = true,
  onClose,
  showMapLink = false,
}: {
  // 검색결과("장소 카탈로그")에서 상세보기 할 때는 placeId, 여행 상세의 장소 카드에서
  // 볼 때는 tripPlaceId — 둘은 서로 다른 id 공간이라 백엔드 엔드포인트도 다르다.
  placeId?: number | null;
  tripPlaceId?: number | null;
  // 호출부 화면에 이미 이 장소를 가리키는 메인 지도가 항상 떠 있으면(저장 장소 화면
  // 처럼) 미니맵이 중복이니 false로 끈다. 메인 지도가 스크롤에 가려질 수 있는 화면
  // (여행 상세, 영상 속 장소)에서는 기본값 true를 그대로 쓴다.
  showMiniMap?: boolean;
  // 있으면 닫기(×)를 장소 이름과 같은 줄 오른쪽에 둔다. 찜한 장소 화면은 ×가 혼자 한 줄을 차지해 제목이 밀렸다(2026-10 QA S6).
  onClose?: () => void;
  // 카카오맵에서 보기·전화 걸기 버튼. 영상 속 장소 상세(SavedPlaceInfoSheet)와 같은 모양(2026-10 QA S3).
  // 전화번호는 서버가 Google 장소 상세에서 받아 둔 경우에만 온다(#99).
  showMapLink?: boolean;
}) {
  const [showRawReviews, setShowRawReviews] = useState(false);
  const detailQuery = useQuery({
    queryKey: tripPlaceId !== null ? ["tripPlaceDetails", tripPlaceId] : ["placeDetails", placeId],
    queryFn: () =>
      tripPlaceId !== null ? getTripPlaceDetails(tripPlaceId) : getPlaceDetails(placeId as number),
    enabled: placeId !== null || tripPlaceId !== null,
  });
  const detail = detailQuery.data;
  const mapUrl = detail ? kakaoMapUrl({ placeName: detail.name, latitude: detail.latitude, longitude: detail.longitude }) : null;
  const telUrl = detail ? phoneUrl({ placeName: detail.name, phone: detail.phone }) : null;

  const [loadingPercent, setLoadingPercent] = useState(0);
  const [showSlowNotice, setShowSlowNotice] = useState(false);
  useEffect(() => {
    if (!detailQuery.isLoading) {
      setLoadingPercent(0);
      setShowSlowNotice(false);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      setLoadingPercent(Math.min(SIMULATED_CAP_PERCENT, Math.round((elapsed / EXPECTED_LOAD_MS) * SIMULATED_CAP_PERCENT)));
      if (elapsed > EXPECTED_LOAD_MS + SLOW_NOTICE_DELAY_MS) {
        setShowSlowNotice(true);
      }
    }, 150);
    return () => clearInterval(timer);
  }, [detailQuery.isLoading, placeId, tripPlaceId]);

  if (detailQuery.isLoading || !detail) {
    return (
      <View style={{ gap: space.xs, paddingVertical: space.sm }}>
        <AppText style={{ color: colors.inkMuted, fontSize: fontSize.footnote }}>
          리뷰 요약을 만들고 있어요... {loadingPercent}%
        </AppText>
        <ProgressBar percent={loadingPercent} />
        {showSlowNotice && (
          <AppText style={{ color: colors.inkMuted, fontSize: fontSize.caption1 }}>
            무료 API를 쓰고 있어서 가끔 평소보다 오래 걸릴 수 있어요.
          </AppText>
        )}
      </View>
    );
  }

  return (
    <>
      <View style={{ gap: space.xxs }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm }}>
          <AppText weight="medium" style={{ flex: 1, fontSize: fontSize.callout }}>
            {detail.name}
          </AppText>
          {onClose && <SheetCloseButton onPress={onClose} />}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
          {categoryLabel(detail.category) && (
            <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>{categoryLabel(detail.category)}</AppText>
          )}
          {categoryLabel(detail.category) && detail.rating !== null && (
            <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>·</AppText>
          )}
          {detail.rating !== null && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.xxs }}>
              <RatingBadge rating={detail.rating} />
              {detail.userRatingCount !== null && (
                <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>(리뷰 {formatCount(detail.userRatingCount)}개)</AppText>
              )}
            </View>
          )}
        </View>
        {detail.address && <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>{detail.address}</AppText>}
      </View>
      {showMapLink && (mapUrl || telUrl) && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
          {mapUrl && (
            <PressableScale onPress={() => openExternal(mapUrl)} style={linkButtonStyle}>
              <Feather name="map" size={14} color={colors.ink} />
              <AppText style={{ fontSize: fontSize.footnote }}>카카오맵에서 보기</AppText>
            </PressableScale>
          )}
          {/* 전화번호는 서버가 Google 장소 상세에서 받아 둔 것만(#99) — 없는 장소는 버튼을 숨긴다 */}
          {telUrl && (
            <PressableScale onPress={() => openExternal(telUrl)} style={linkButtonStyle}>
              <Feather name="phone" size={14} color={colors.ink} />
              <AppText style={{ fontSize: fontSize.footnote }}>전화 걸기</AppText>
            </PressableScale>
          )}
        </View>
      )}
      {/* 메인 지도가 화면 밖으로 스크롤된 상태에서 카드를 열어도 위치를 볼 수 있게,
          장소 상세 카드/시트 안에 그 장소 하나만 보여주는 작은 지도를 함께 넣는다
          (에어비앤비/옐프 등 장소 상세 화면의 흔한 패턴 — 메인 지도와 별개로 동작). */}
      {showMiniMap && detail.latitude !== null && detail.longitude !== null && (
        <InlineMap
          pins={[{ id: "selected", latitude: detail.latitude, longitude: detail.longitude }]}
          height={120}
          showPath={false}
        />
      )}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginVertical: space.sm }} />
      <View style={{ gap: space.sm }}>
        <AppText weight="medium" style={{ fontSize: fontSize.footnote, color: colors.inkMuted }}>
          리뷰 요약
        </AppText>
        <HighlightedText text={detail.highlights} />

        {(detail.pros.length > 0 || detail.cons.length > 0) && (
          <View style={{ flexDirection: "row", gap: space.md }}>
            {detail.pros.length > 0 && (
              <View style={{ flex: 1, gap: space.xxxs }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.xxs }}>
                  <Emoji symbol="👍" size={12} />
                  <AppText weight="medium" style={{ fontSize: fontSize.caption2, color: colors.inkMuted }}>
                    좋은 점
                  </AppText>
                </View>
                {detail.pros.map((p, i) => (
                  <AppText key={i} style={{ fontSize: fontSize.caption1 }}>
                    {p}
                  </AppText>
                ))}
              </View>
            )}
            {detail.cons.length > 0 && (
              <View style={{ flex: 1, gap: space.xxxs }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.xxs }}>
                  <Emoji symbol="👎" size={12} />
                  <AppText weight="medium" style={{ fontSize: fontSize.caption2, color: colors.inkMuted }}>
                    아쉬운 점
                  </AppText>
                </View>
                {detail.cons.map((c, i) => (
                  <AppText key={i} style={{ fontSize: fontSize.caption1 }}>
                    {c}
                  </AppText>
                ))}
              </View>
            )}
          </View>
        )}

        {(detail.hours || detail.fee) && (
          <View style={{ gap: space.xxs }}>
            {detail.hours && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.xxs }}>
                <Feather name="clock" size={12} color={colors.ink} />
                <AppText style={{ fontSize: fontSize.caption1 }}>{detail.hours}</AppText>
              </View>
            )}
            {detail.fee && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.xxs }}>
                <Feather name="dollar-sign" size={12} color={colors.ink} />
                <AppText style={{ fontSize: fontSize.caption1 }}>{detail.fee}</AppText>
              </View>
            )}
          </View>
        )}

        {detail.tips.length > 0 && (
          <View style={{ padding: space.sm, borderRadius: radius.sm, backgroundColor: colors.accentBg, gap: space.xxxs }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.xxs }}>
              <Emoji symbol="💡" size={12} />
              <AppText weight="medium" style={{ fontSize: fontSize.caption2, color: colors.accent }}>
                꿀팁
              </AppText>
            </View>
            {detail.tips.map((tip, i) => (
              <AppText key={i} style={{ fontSize: fontSize.caption1 }}>
                {tip}
              </AppText>
            ))}
          </View>
        )}

        {detail.checklist.length > 0 && (
          <View style={{ gap: space.xxs }}>
            {detail.checklist.map((item, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: space.xxs }}>
                <Feather name="square" size={12} color={colors.inkMuted} />
                <AppText style={{ fontSize: fontSize.caption1 }}>{item}</AppText>
              </View>
            ))}
          </View>
        )}

        {detail.reviewSnippets.length > 0 && (
          <View style={{ gap: space.xxs }}>
            <PressableScale onPress={() => setShowRawReviews((current) => !current)}>
              <AppText style={{ fontSize: fontSize.caption2, color: colors.inkMuted }}>
                {showRawReviews ? "실제 리뷰 원문 접기 ▲" : "실제 리뷰 원문 보기 ▼"}
              </AppText>
            </PressableScale>
            {showRawReviews &&
              detail.reviewSnippets.slice(0, 3).map((snippet, i) => (
                <AppText
                  key={i}
                  style={{ fontSize: fontSize.caption1, color: colors.inkMuted, borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: space.xs }}
                >
                  &ldquo;{snippet}&rdquo;
                </AppText>
              ))}
          </View>
        )}
      </View>
    </>
  );
}

// 지도가 있는 화면(여행 상세 등)에서 쓴다 — 전체화면 Modal과 달리 뒤/위 배경을
// 어둡게 덮지 않고 터치도 막지 않는다(네이버 지도의 "장소 카드" 방식). 살짝
// 드래그해서 스냅포인트만 바뀌는 동안은 onClose가 불리지 않아 선택 상태가
// 유지되고, 임계값 이상으로 끝까지 내리면 그때만 닫힌다.
//
// BottomSheetModal(포털 기반) 대신, 저장 장소 화면에서 이미 검증된 일반
// BottomSheet를 index=-1(닫힘)로 항상 마운트해두고 ref로 열고 닫는 방식을 쓴다 —
// 호출부(화면)에서 DraggableFlatList/ScrollView의 형제 요소로, 화면 최상단에
// 직접 렌더링해야 한다(리스트 footer 등 스크롤되는 콘텐츠 안에 넣으면 시트가
// 화면 바닥이 아니라 그 안에 갇힌다).
export function PlaceReviewSheet({
  placeId = null,
  tripPlaceId = null,
  onClose,
}: {
  placeId?: number | null;
  tripPlaceId?: number | null;
  onClose: () => void;
}) {
  const sheetRef = useRef<BottomSheet>(null);
  const isOpen = placeId !== null || tripPlaceId !== null;

  useEffect(() => {
    if (isOpen) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [isOpen]);

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={SHEET_SNAP_POINTS}
      enableDynamicSizing={false}
      enablePanDownToClose
      onClose={() => {
        onClose();
      }}
    >
      <BottomSheetScrollView contentContainerStyle={{ padding: space.lg, gap: space.sm }}>
        <SheetCloseButton onPress={() => sheetRef.current?.close()} style={{ alignSelf: "flex-end" }} />
        <PlaceReviewContent placeId={placeId} tripPlaceId={tripPlaceId} />
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
