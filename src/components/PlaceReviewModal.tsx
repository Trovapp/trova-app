import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { ProgressBar } from "@/components/ProgressBar";
import { getPlaceDetails } from "@/lib/api/recommendations";
import { getTripPlaceDetails } from "@/lib/api/trips";
import { colors } from "@/lib/theme";

// 리뷰 요약 생성은 단일 요청(검색 매칭 + Gemini 생성)이라 백엔드가 실제 단계별
// 진행률을 알려주지 않는다. 그래서 "체감 진행률"만 흉내낸다 — 예상 소요시간(6초)
// 동안 92%까지 서서히 채우고, 실제 응답이 오면(로딩 종료) 그 즉시 콘텐츠로 바뀐다.
const EXPECTED_LOAD_MS = 6000;
const SIMULATED_CAP_PERCENT = 92;

function HighlightedText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <AppText style={{ fontSize: 13, lineHeight: 19 }}>
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

export function PlaceReviewModal({
  visible,
  placeId = null,
  tripPlaceId = null,
  onClose,
}: {
  visible: boolean;
  // 검색결과("장소 카탈로그")에서 상세보기 할 때는 placeId, 여행 상세의 장소 카드에서
  // 볼 때는 tripPlaceId — 둘은 서로 다른 id 공간이라 백엔드 엔드포인트도 다르다.
  placeId?: number | null;
  tripPlaceId?: number | null;
  onClose: () => void;
}) {
  const [showRawReviews, setShowRawReviews] = useState(false);
  const detailQuery = useQuery({
    queryKey: tripPlaceId !== null ? ["tripPlaceDetails", tripPlaceId] : ["placeDetails", placeId],
    queryFn: () =>
      tripPlaceId !== null ? getTripPlaceDetails(tripPlaceId) : getPlaceDetails(placeId as number),
    enabled: placeId !== null || tripPlaceId !== null,
  });
  const detail = detailQuery.data;

  const [loadingPercent, setLoadingPercent] = useState(0);
  useEffect(() => {
    if (!detailQuery.isLoading) {
      setLoadingPercent(0);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      setLoadingPercent(Math.min(SIMULATED_CAP_PERCENT, Math.round((elapsed / EXPECTED_LOAD_MS) * SIMULATED_CAP_PERCENT)));
    }, 150);
    return () => clearInterval(timer);
  }, [detailQuery.isLoading, placeId, tripPlaceId]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={() => setShowRawReviews(false)}
    >
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end" }} onPress={onClose}>
        <Pressable
          style={{ maxHeight: "75%", backgroundColor: colors.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
            {detailQuery.isLoading || !detail ? (
              <View style={{ gap: 8, paddingVertical: 12 }}>
                <AppText style={{ color: colors.inkMuted, fontSize: 13 }}>
                  리뷰 요약을 만들고 있어요... {loadingPercent}%
                </AppText>
                <ProgressBar percent={loadingPercent} />
              </View>
            ) : (
              <>
                <View style={{ gap: 4 }}>
                  <AppText weight="medium" style={{ fontSize: 17 }}>
                    {detail.name}
                  </AppText>
                  <AppText style={{ fontSize: 12, color: colors.inkMuted }}>
                    {[
                      detail.category,
                      detail.rating !== null
                        ? `⭐ ${detail.rating.toFixed(1)}${detail.userRatingCount !== null ? ` (리뷰 ${detail.userRatingCount}개)` : ""}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </AppText>
                  {detail.address && (
                    <AppText style={{ fontSize: 12, color: colors.inkMuted }}>{detail.address}</AppText>
                  )}
                </View>
                <View style={{ borderTopWidth: 1, borderTopColor: colors.border }} />
                <AppText weight="medium" style={{ fontSize: 13, color: colors.inkMuted }}>
                  리뷰 요약
                </AppText>
                <HighlightedText text={detail.highlights} />

                {(detail.pros.length > 0 || detail.cons.length > 0) && (
                  <View style={{ flexDirection: "row", gap: 16 }}>
                    {detail.pros.length > 0 && (
                      <View style={{ flex: 1, gap: 2 }}>
                        <AppText weight="medium" style={{ fontSize: 11, color: colors.inkMuted }}>
                          👍 좋은 점
                        </AppText>
                        {detail.pros.map((p, i) => (
                          <AppText key={i} style={{ fontSize: 12 }}>
                            {p}
                          </AppText>
                        ))}
                      </View>
                    )}
                    {detail.cons.length > 0 && (
                      <View style={{ flex: 1, gap: 2 }}>
                        <AppText weight="medium" style={{ fontSize: 11, color: colors.inkMuted }}>
                          👎 아쉬운 점
                        </AppText>
                        {detail.cons.map((c, i) => (
                          <AppText key={i} style={{ fontSize: 12 }}>
                            {c}
                          </AppText>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {(detail.hours || detail.fee) && (
                  <View style={{ gap: 2 }}>
                    {detail.hours && <AppText style={{ fontSize: 12 }}>🕐 {detail.hours}</AppText>}
                    {detail.fee && <AppText style={{ fontSize: 12 }}>💰 {detail.fee}</AppText>}
                  </View>
                )}

                {detail.tips.length > 0 && (
                  <View style={{ padding: 10, borderRadius: 8, backgroundColor: colors.accentBg, gap: 2 }}>
                    <AppText weight="medium" style={{ fontSize: 11, color: colors.accent }}>
                      💡 꿀팁
                    </AppText>
                    {detail.tips.map((tip, i) => (
                      <AppText key={i} style={{ fontSize: 12 }}>
                        {tip}
                      </AppText>
                    ))}
                  </View>
                )}

                {detail.checklist.length > 0 && (
                  <View style={{ gap: 2 }}>
                    {detail.checklist.map((item, i) => (
                      <AppText key={i} style={{ fontSize: 12 }}>
                        ☐ {item}
                      </AppText>
                    ))}
                  </View>
                )}

                {detail.reviewSnippets.length > 0 && (
                  <View style={{ gap: 4 }}>
                    <Pressable onPress={() => setShowRawReviews((current) => !current)}>
                      <AppText style={{ fontSize: 11, color: colors.inkMuted }}>
                        {showRawReviews ? "실제 리뷰 원문 접기 ▲" : "실제 리뷰 원문 보기 ▼"}
                      </AppText>
                    </Pressable>
                    {showRawReviews &&
                      detail.reviewSnippets.slice(0, 3).map((snippet, i) => (
                        <AppText
                          key={i}
                          style={{ fontSize: 12, color: colors.inkMuted, borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: 8 }}
                        >
                          &ldquo;{snippet}&rdquo;
                        </AppText>
                      ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
