import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { getPlaceDetails } from "@/lib/api/recommendations";
import { colors } from "@/lib/theme";

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
  placeId,
  onClose,
}: {
  visible: boolean;
  placeId: number | null;
  onClose: () => void;
}) {
  const [showRawReviews, setShowRawReviews] = useState(false);
  const detailQuery = useQuery({
    queryKey: ["placeDetails", placeId],
    queryFn: () => getPlaceDetails(placeId as number),
    enabled: placeId !== null,
  });
  const detail = detailQuery.data;

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
              <AppText style={{ color: colors.inkMuted }}>리뷰 요약을 불러오는 중...</AppText>
            ) : (
              <>
                <AppText weight="medium" style={{ fontSize: 17 }}>
                  {detail.name}
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
