import { useEffect, useRef, useState, type ElementRef } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { useQueryClient } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { InlineMap } from "@/components/InlineMap";
import { PlaceReviewContent } from "@/components/PlaceReviewModal";
import { PressableScale } from "@/components/PressableScale";
import { RatingBadge } from "@/components/RatingBadge";
import { RecommendationReason } from "@/components/RecommendationReason";
import { haptics } from "@/lib/haptics";
import { categoryLabel } from "@/lib/placeCategory";
import { colors } from "@/lib/theme";
import { replacePlace, type AlternativeCandidate } from "@/lib/api/trips";
import { endConversationSession, sendConversationMessage } from "@/lib/api/conversations";

const SNAP_POINTS = ["65%", "90%"];
const MAX_MESSAGE_LENGTH = 300;
const EXAMPLE_PROMPTS = ["조용한 카페 알려줘", "사람 적은 곳 있어?", "분위기 좋은 곳으로 바꿔줘"];

// 카드가 텍스트만 있으면 다 비슷해 보여서, 카테고리 문자열(Google Places 타입 또는
// 한글 카테고리)을 훑어 어울리는 아이콘 하나를 붙인다 — 사진을 새로 붙이려면 Google
// Places Photo API 호출이 필요해서(비용 이슈) 그 전 단계의 저비용 개선. 음식/장소
// 카테고리별로 구분되는 아이콘이 Feather엔 없어서 이 함수만 MaterialCommunityIcons를
// 쓴다(나머지 화면은 전부 Feather로 통일).
function categoryIcon(category: string | null): keyof typeof MaterialCommunityIcons.glyphMap {
  if (!category) return "map-marker";
  const c = category.toLowerCase();
  if (c.includes("cafe") || c.includes("coffee") || c.includes("카페")) return "coffee";
  if (c.includes("bakery") || c.includes("베이커리")) return "bread-slice";
  if (c.includes("restaurant") || c.includes("food") || c.includes("음식")) return "silverware-fork-knife";
  if (c.includes("bar") || c.includes("pub") || c.includes("술")) return "glass-cocktail";
  if (c.includes("ice_cream") || c.includes("dessert")) return "ice-cream";
  if (c.includes("museum") || c.includes("박물관")) return "bank";
  if (c.includes("park") || c.includes("공원")) return "tree";
  if (c.includes("shop") || c.includes("store") || c.includes("쇼핑")) return "shopping";
  if (c.includes("hotel") || c.includes("guest_house") || c.includes("lodging")) return "bed";
  if (c.includes("landmark") || c.includes("tourist") || c.includes("관광")) return "camera";
  return "map-marker";
}

type ChatMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; candidates: AlternativeCandidate[] | null };

// 최신 RN/Hermes(이 프로젝트 0.86.x)는 crypto.randomUUID를 기본 지원하지만,
// 혹시 없는 환경에서도 세션 식별자로 충분한 값을 만들 수 있게 폴백을 둔다 —
// sessionId는 비밀값이 아니라(서버가 소유권을 매 요청마다 검증) 충돌만 피하면 된다.
function generateSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Gemini 답변에 마크다운 강조(**굵게**, *기울임*)가 섞여 오는데, 채팅 말풍선은
// 마크다운을 렌더링하지 않는 일반 Text라 별표가 그대로 문자로 보인다 — 별표만
// 제거하고 안의 텍스트는 그대로 둔다(서식 없이 평문으로 표시).
function stripMarkdownEmphasis(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
}

function CompactCandidateCard({
  candidate,
  active,
  onPress,
}: {
  candidate: AlternativeCandidate;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      style={{
        width: 140,
        padding: 10,
        borderRadius: 10,
        borderWidth: active ? 2 : 1,
        borderColor: active ? colors.accent : colors.border,
        backgroundColor: colors.bg,
        gap: 2,
      }}
    >
      <AppText weight="medium" style={{ fontSize: 12 }} numberOfLines={1}>
        {candidate.name}
      </AppText>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
        <MaterialCommunityIcons name={categoryIcon(candidate.category)} size={11} color={colors.inkMuted} />
        {categoryLabel(candidate.category) && (
          <AppText style={{ fontSize: 11, color: colors.inkMuted }} numberOfLines={1}>
            {categoryLabel(candidate.category)}
          </AppText>
        )}
        {candidate.rating !== null && <RatingBadge rating={candidate.rating} size={10} />}
      </View>
    </PressableScale>
  );
}

function ExpandedCandidateCard({
  candidate,
  onConfirm,
  confirming,
  error,
  onOpenReview,
}: {
  candidate: AlternativeCandidate;
  onConfirm: () => void;
  confirming: boolean;
  error: string | null;
  onOpenReview: () => void;
}) {
  return (
    <View style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
      <AppText weight="medium">{candidate.name}</AppText>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
        <MaterialCommunityIcons name={categoryIcon(candidate.category)} size={12} color={colors.inkMuted} />
        <AppText style={{ fontSize: 12, color: colors.inkMuted }}>
          {[categoryLabel(candidate.category), candidate.address].filter(Boolean).join(" · ")}
        </AppText>
        {candidate.rating !== null && <RatingBadge rating={candidate.rating} />}
      </View>
      {candidate.recommendationReason && <RecommendationReason text={candidate.recommendationReason} />}
      <InlineMap
        pins={[{ id: "selected", latitude: candidate.latitude, longitude: candidate.longitude, color: colors.accent }]}
        height={110}
        showPath={false}
      />
      <PressableScale onPress={onOpenReview} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <AppText style={{ fontSize: 12, color: colors.accent }}>리뷰 보기</AppText>
        <Feather name="chevron-right" size={12} color={colors.accent} />
      </PressableScale>
      {error && <AppText style={{ color: colors.accent, fontSize: 12 }}>{error}</AppText>}
      <PressableScale
        onPress={onConfirm}
        disabled={confirming}
        style={{
          height: 42,
          borderRadius: 10,
          backgroundColor: colors.accent,
          justifyContent: "center",
          alignItems: "center",
          opacity: confirming ? 0.6 : 1,
        }}
      >
        <AppText weight="medium" style={{ color: "#fff" }}>
          {confirming ? "교체 중..." : "이 장소로 확정"}
        </AppText>
      </PressableScale>
    </View>
  );
}

function CandidateRow({
  candidates,
  expandedPlaceId,
  onToggle,
  onConfirm,
  confirming,
  confirmError,
  onOpenReview,
}: {
  candidates: AlternativeCandidate[];
  expandedPlaceId: number | null;
  onToggle: (placeId: number) => void;
  onConfirm: (candidate: AlternativeCandidate) => void;
  confirming: boolean;
  confirmError: string | null;
  onOpenReview: (placeId: number) => void;
}) {
  const expanded = candidates.find((c) => c.placeId === expandedPlaceId) ?? null;
  return (
    <View style={{ gap: 10 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {candidates.map((candidate) => (
          <CompactCandidateCard
            key={candidate.placeId}
            candidate={candidate}
            active={candidate.placeId === expandedPlaceId}
            onPress={() => onToggle(candidate.placeId)}
          />
        ))}
      </ScrollView>
      {expanded && (
        <ExpandedCandidateCard
          candidate={expanded}
          onConfirm={() => onConfirm(expanded)}
          confirming={confirming}
          error={confirmError}
          onOpenReview={() => onOpenReview(expanded.placeId)}
        />
      )}
    </View>
  );
}

// 비서 쪽 말풍선에만 붙이는 작은 아이콘 — 양쪽에 다 붙이면 오히려 산만해져서
// 비서 쪽에만 둬서 "누가 말하는지"를 한눈에 구분되게 한다.
function AssistantAvatar() {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: colors.accentBg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Feather name="message-circle" size={12} color={colors.accent} />
    </View>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: isUser ? "flex-end" : "flex-start",
        alignItems: "flex-end",
        gap: 6,
      }}
    >
      {!isUser && <AssistantAvatar />}
      <View
        style={{
          maxWidth: "80%",
          padding: 10,
          borderRadius: 12,
          backgroundColor: isUser ? colors.accent : colors.bgMuted,
        }}
      >
        <AppText style={{ color: isUser ? "#fff" : colors.ink, fontSize: 14 }}>{message.text}</AppText>
      </View>
    </View>
  );
}

export function ConversationSheet({
  tripId,
  tripPlaceId,
  onReplaced,
  onClose,
}: {
  tripId: number;
  tripPlaceId: number | null;
  onReplaced: () => void;
  onClose: () => void;
}) {
  const sheetRef = useRef<BottomSheet>(null);
  const scrollRef = useRef<ElementRef<typeof BottomSheetScrollView>>(null);
  const queryClient = useQueryClient();
  const sessionIdRef = useRef<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [turnLimitReached, setTurnLimitReached] = useState(false);
  const [expandedPlaceId, setExpandedPlaceId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [reviewCandidateId, setReviewCandidateId] = useState<number | null>(null);

  const isOpen = tripPlaceId !== null;

  // 시트를 처음 열 때와, 턴 상한에 도달해 "새로 시작하기"를 눌렀을 때 둘 다 같은
  // 초기화가 필요해서 공용 함수로 뺐다.
  function resetSession() {
    sessionIdRef.current = generateSessionId();
    setMessages([]);
    setInput("");
    setSendError(null);
    setTurnLimitReached(false);
    setExpandedPlaceId(null);
    setConfirmError(null);
    setReviewCandidateId(null);
  }

  useEffect(() => {
    if (isOpen) {
      resetSession();
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripPlaceId]);

  // 리뷰 패널 ↔ 채팅 전환 시 이전 스크롤 위치가 그대로 남아있지 않도록 맨 위로
  // (AlternativeFinderSheet와 같은 이유).
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [reviewCandidateId]);

  // 시트가 실제로 닫힐 때(사용자가 끌어내리거나 onClose 경로)만 세션을 정리한다 —
  // 열려있는 동안의 리렌더에서 매번 호출되면 안 되므로 onClose 콜백 쪽에서만 부른다.
  function handleSheetClose() {
    haptics.light();
    if (sessionIdRef.current) {
      endConversationSession(sessionIdRef.current);
    }
    onClose();
  }

  async function handleSend(messageOverride?: string) {
    const trimmed = (messageOverride ?? input).trim();
    if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH || sending || turnLimitReached || tripPlaceId === null) {
      return;
    }
    setSending(true);
    setSendError(null);
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    try {
      const result = await sendConversationMessage(sessionIdRef.current, {
        message: trimmed,
        tripId,
        tripPlaceId,
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: stripMarkdownEmphasis(result.reply), candidates: result.candidates },
      ]);
      setTurnLimitReached(result.turnLimitReached);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch {
      setSendError("지금 답변을 가져오지 못했어요. 다시 시도해주세요.");
    } finally {
      setSending(false);
    }
  }

  async function handleConfirm(candidate: AlternativeCandidate) {
    if (tripPlaceId === null || confirming) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      await replacePlace(tripPlaceId, candidate.googlePlaceId);
      await queryClient.invalidateQueries({ queryKey: ["trip"] });
      await queryClient.invalidateQueries({ queryKey: ["gapRecommendations"] });
      onReplaced();
    } catch {
      setConfirmError("교체하지 못했어요. 다시 시도해주세요.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      enablePanDownToClose
      onClose={handleSheetClose}
    >
      <BottomSheetScrollView ref={scrollRef} contentContainerStyle={{ padding: 20, gap: 14 }}>
        {reviewCandidateId !== null ? (
          <>
            <PressableScale
              onPress={() => setReviewCandidateId(null)}
              hitSlop={8}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Feather name="chevron-left" size={18} color={colors.accent} />
              <AppText style={{ fontSize: 14, color: colors.accent }}>대화로</AppText>
            </PressableScale>
            <PlaceReviewContent placeId={reviewCandidateId} showMiniMap={false} />
          </>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Feather name="message-circle" size={16} color={colors.accent} />
              <AppText weight="medium" style={{ fontSize: 16 }}>
                비서에게 물어보기
              </AppText>
            </View>

            {messages.length === 0 && (
              <View style={{ gap: 8 }}>
                <AppText style={{ fontSize: 13, color: colors.inkMuted }}>이렇게 물어보세요</AppText>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {EXAMPLE_PROMPTS.map((prompt) => (
                    <PressableScale
                      key={prompt}
                      onPress={() => handleSend(prompt)}
                      style={{
                        paddingVertical: 7,
                        paddingHorizontal: 12,
                        borderRadius: 16,
                        backgroundColor: colors.bgMuted,
                      }}
                    >
                      <AppText style={{ fontSize: 12, color: colors.inkMuted }}>{prompt}</AppText>
                    </PressableScale>
                  ))}
                </View>
              </View>
            )}

            {messages.map((message, index) => (
              <View key={index} style={{ gap: 10 }}>
                <MessageBubble message={message} />
                {message.role === "assistant" && message.candidates && message.candidates.length > 0 && (
                  <CandidateRow
                    candidates={message.candidates}
                    expandedPlaceId={expandedPlaceId}
                    onToggle={(placeId) => setExpandedPlaceId((current) => (current === placeId ? null : placeId))}
                    onConfirm={handleConfirm}
                    confirming={confirming}
                    confirmError={confirmError}
                    onOpenReview={setReviewCandidateId}
                  />
                )}
              </View>
            ))}

            {sending && (
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
                <AssistantAvatar />
                <View style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.bgMuted }}>
                  <ActivityIndicator size="small" color={colors.inkMuted} />
                </View>
              </View>
            )}

            {sendError && <AppText style={{ color: colors.accent, fontSize: 12 }}>{sendError}</AppText>}

            {turnLimitReached ? (
              <View style={{ alignItems: "center", gap: 8, padding: 8 }}>
                <AppText style={{ fontSize: 12, color: colors.inkMuted, textAlign: "center" }}>
                  이번 대화의 최대 턴 수에 도달했어요.
                </AppText>
                <PressableScale
                  onPress={resetSession}
                  style={{ paddingVertical: 9, paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.accent }}
                >
                  <AppText weight="medium" style={{ color: "#fff", fontSize: 13 }}>
                    새로 시작하기
                  </AppText>
                </PressableScale>
              </View>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                <BottomSheetTextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="메시지 입력"
                  placeholderTextColor={colors.inkMuted}
                  multiline
                  maxLength={MAX_MESSAGE_LENGTH}
                  editable={!sending}
                  style={{
                    flex: 1,
                    maxHeight: 90,
                    padding: 10,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.bg,
                    fontSize: 14,
                    color: colors.ink,
                  }}
                />
                <PressableScale
                  onPress={() => handleSend()}
                  disabled={sending || !input.trim()}
                  hitSlop={8}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    backgroundColor: colors.accent,
                    justifyContent: "center",
                    alignItems: "center",
                    opacity: sending || !input.trim() ? 0.5 : 1,
                  }}
                >
                  <Feather name="send" size={18} color="#fff" />
                </PressableScale>
              </View>
            )}
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
