import { useMemo, useState } from "react";
import { Modal, Pressable, TextInput, View } from "react-native";
import BottomSheet, { BottomSheetFlatList, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { FolderPickerModal } from "@/components/FolderPickerModal";
import { InlineMap } from "@/components/InlineMap";
import { PlaceReviewContent } from "@/components/PlaceReviewModal";
import { QueryErrorView } from "@/components/QueryErrorView";
import {
  addBookmark,
  listBookmarks,
  listFolders,
  moveBookmarkToFolder,
  removeBookmark,
  type Bookmark,
  type BookmarkFolder,
} from "@/lib/api/bookmarks";
import { searchPlaces, type RecommendedPlace } from "@/lib/api/recommendations";
import { colors } from "@/lib/theme";

const UNSORTED_ID = -1; // "미분류" 가상 폴더 id — 실제 폴더 id는 항상 양수(DB IDENTITY)라 겹치지 않는다.

// FolderPickerModal은 "어디에 저장할지" 하나만 고르는 UI라, 찜 추가(add)와
// 폴더 이동(move)에 그대로 재사용한다 — onPick 콜백에서 이 target으로 분기한다.
type FolderPickerTarget = { mode: "add"; placeId: number } | { mode: "move"; bookmarkId: number };

export function SavedPlacesScreen() {
  const bookmarksQuery = useQuery({ queryKey: ["bookmarks"], queryFn: listBookmarks });
  const foldersQuery = useQuery({ queryKey: ["bookmarkFolders"], queryFn: listFolders });
  const queryClient = useQueryClient();
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null); // null = 폴더 목록 보기
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RecommendedPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [folderPickerTarget, setFolderPickerTarget] = useState<FolderPickerTarget | null>(null);
  const [reviewPlaceId, setReviewPlaceId] = useState<number | null>(null);
  const [menuBookmarkId, setMenuBookmarkId] = useState<number | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const snapPoints = useMemo(() => ["18%", "55%", "90%"], []);

  if (bookmarksQuery.isLoading || foldersQuery.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AppText>불러오는 중...</AppText>
      </View>
    );
  }

  // 조회 실패를 "장소 없음"(빈 지도 + 미분류 0개)으로 보여주지 않는다.
  if (bookmarksQuery.isError || foldersQuery.isError) {
    return (
      <QueryErrorView
        fullScreen
        message="저장 장소를 불러오지 못했어요. 네트워크 상태를 확인하고 다시 시도해주세요."
        onRetry={() => {
          if (bookmarksQuery.isError) bookmarksQuery.refetch();
          if (foldersQuery.isError) foldersQuery.refetch();
        }}
      />
    );
  }

  const bookmarks = bookmarksQuery.data ?? [];
  const folders = foldersQuery.data ?? [];
  const folderColorById = new Map(folders.map((f) => [f.id, f.color]));

  const visibleBookmarks =
    activeFolderId === null
      ? bookmarks
      : activeFolderId === UNSORTED_ID
        ? bookmarks.filter((b) => b.folderId === null)
        : bookmarks.filter((b) => b.folderId === activeFolderId);

  const activeFolder: { name: string; color: string } | null =
    activeFolderId === null
      ? null
      : activeFolderId === UNSORTED_ID
        ? { name: "미분류", color: colors.inkMuted }
        : (folders.find((f) => f.id === activeFolderId) ?? null);

  const menuBookmark = visibleBookmarks.find((b) => b.id === menuBookmarkId) ?? null;

  // 검색 중일 땐 저장된 장소 대신 검색 결과를 지도에 보여준다(네이버 지도처럼
  // "지금 찾고 있는 곳"이 곧 지도의 관심사가 되므로).
  // 핀 id는 placeId로 통일한다 — 카드를 탭했을 때 여는 리뷰 모달도 placeId를
  // 기준으로 열리므로(reviewPlaceId), 같은 id로 지도 핀을 선택/하이라이트할 수 있다.
  const pins =
    searchResults.length > 0
      ? searchResults
          .filter((p) => p.latitude !== null && p.longitude !== null)
          .map((p) => ({
            id: String(p.id),
            latitude: p.latitude as number,
            longitude: p.longitude as number,
            color: colors.accent,
          }))
      : visibleBookmarks
          .filter((b) => b.latitude !== null && b.longitude !== null)
          .map((b) => ({
            id: String(b.placeId),
            latitude: b.latitude as number,
            longitude: b.longitude as number,
            color: b.folderId !== null ? folderColorById.get(b.folderId) : colors.inkMuted,
          }));

  const unsortedCount = bookmarks.filter((b) => b.folderId === null).length;
  const bookmarkedPlaceIds = new Set(bookmarks.map((b) => b.placeId));

  async function handleRemove(id: number) {
    setRemoveError(null);
    try {
      await removeBookmark(id);
      await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    } catch {
      setRemoveError("장소를 제거하지 못했어요.");
    }
  }

  async function handleSearch() {
    if (!query.trim() || searching) return;
    setSearching(true);
    setSearchError(null);
    try {
      setSearchResults(await searchPlaces(query.trim()));
    } catch {
      setSearchError("장소를 찾지 못했어요. 다른 검색어로 시도해보세요.");
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setQuery("");
    setSearchResults([]);
    setSearchError(null);
  }

  async function handlePickFolder(folderId: number | null) {
    if (folderPickerTarget === null) return;
    const target = folderPickerTarget;
    setFolderPickerTarget(null);
    try {
      if (target.mode === "add") {
        await addBookmark(target.placeId, folderId);
      } else {
        await moveBookmarkToFolder(target.bookmarkId, folderId);
      }
      await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    } catch {
      if (target.mode === "add") {
        setSearchError("찜하기에 실패했어요.");
      } else {
        setMoveError("폴더를 옮기지 못했어요.");
      }
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="장소 이름으로 검색 (예: 경복궁)"
          onSubmitEditing={handleSearch}
          style={{
            flex: 1,
            height: 40,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            paddingHorizontal: 12,
            fontFamily: "NotoSansKR_400Regular",
          }}
        />
        <Pressable
          onPress={handleSearch}
          disabled={searching || !query.trim()}
          style={{
            height: 40,
            paddingHorizontal: 14,
            borderRadius: 10,
            backgroundColor: colors.accent,
            justifyContent: "center",
            alignItems: "center",
            opacity: searching || !query.trim() ? 0.6 : 1,
          }}
        >
          <AppText weight="medium" style={{ color: "#fff" }}>
            {searching ? "검색 중..." : "검색"}
          </AppText>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        <InlineMap pins={pins} fill showPath={false} selectedId={reviewPlaceId !== null ? String(reviewPlaceId) : null} />

        <BottomSheet index={1} snapPoints={snapPoints} enableDynamicSizing={false}>
        {reviewPlaceId !== null ? (
          // 네이버 지도처럼: 장소 정보를 별도 모달이 아니라 이 바텀시트 안에서 보여준다 —
          // 그래야 시트 밖(지도) 영역이 계속 터치되고, 시트를 살짝 내려도(스냅포인트만
          // 바뀔 뿐) 선택 상태(reviewPlaceId)와 지도 하이라이트가 그대로 유지된다.
          <BottomSheetScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
            <Pressable onPress={() => setReviewPlaceId(null)} hitSlop={8} style={{ alignSelf: "flex-end" }}>
              <AppText style={{ fontSize: 18, color: colors.inkMuted }}>✕</AppText>
            </Pressable>
            <PlaceReviewContent placeId={reviewPlaceId} showMiniMap={false} />
          </BottomSheetScrollView>
        ) : searchResults.length > 0 ? (
          <BottomSheetFlatList
            data={searchResults}
            keyExtractor={(item: RecommendedPlace) => String(item.id)}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            ListHeaderComponent={
              <View style={{ gap: 8, marginBottom: 4 }}>
                <Pressable onPress={clearSearch}>
                  <AppText style={{ color: colors.accent }}>✕ 검색 결과 닫기</AppText>
                </Pressable>
                {searchError && <AppText style={{ color: colors.accent }}>{searchError}</AppText>}
              </View>
            }
            renderItem={({ item }: { item: RecommendedPlace }) => (
              <View
                style={{
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 6,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <AppText weight="medium" numberOfLines={1}>
                      {item.name}
                    </AppText>
                    {item.address && (
                      <AppText style={{ fontSize: 12, color: colors.inkMuted }} numberOfLines={1}>
                        {item.address}
                      </AppText>
                    )}
                    {item.rating !== null && (
                      <AppText style={{ fontSize: 12, color: colors.inkMuted }}>
                        ⭐ {item.rating.toFixed(1)}
                        {item.userRatingCount !== null ? ` (리뷰 ${item.userRatingCount}개)` : ""}
                      </AppText>
                    )}
                  </View>
                  <Pressable onPress={() => setFolderPickerTarget({ mode: "add", placeId: item.id })}>
                    <AppText style={{ fontSize: 18 }}>{bookmarkedPlaceIds.has(item.id) ? "⭐" : "☆"}</AppText>
                  </Pressable>
                </View>
                <Pressable onPress={() => setReviewPlaceId(item.id)}>
                  <AppText style={{ fontSize: 12, color: colors.accent }}>상세보기</AppText>
                </Pressable>
              </View>
            )}
          />
        ) : activeFolderId === null ? (
          <BottomSheetFlatList
            data={[{ id: UNSORTED_ID, name: "미분류", color: colors.inkMuted, placeCount: unsortedCount }, ...folders]}
            keyExtractor={(item: BookmarkFolder) => String(item.id)}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            ListHeaderComponent={
              <AppText weight="medium" style={{ fontSize: 16, marginBottom: 4 }}>
                저장 장소
              </AppText>
            }
            renderItem={({ item }: { item: BookmarkFolder }) => (
              <Pressable
                onPress={() => setActiveFolderId(item.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: item.color }} />
                <AppText style={{ flex: 1 }}>{item.name}</AppText>
                <AppText style={{ fontSize: 12, color: colors.inkMuted }}>{item.placeCount}개</AppText>
              </Pressable>
            )}
          />
        ) : (
          <BottomSheetFlatList
            data={visibleBookmarks}
            keyExtractor={(item: Bookmark) => String(item.id)}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            ListHeaderComponent={
              <View style={{ gap: 8, marginBottom: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: activeFolder?.color ?? colors.inkMuted,
                    }}
                  />
                  <AppText weight="medium" style={{ fontSize: 16, flex: 1 }} numberOfLines={1}>
                    {activeFolder?.name ?? "미분류"}
                  </AppText>
                  <Pressable onPress={() => setActiveFolderId(null)} hitSlop={8}>
                    <AppText style={{ fontSize: 18, color: colors.inkMuted }}>✕</AppText>
                  </Pressable>
                </View>
                {removeError && <AppText style={{ color: colors.accent }}>{removeError}</AppText>}
                {moveError && <AppText style={{ color: colors.accent }}>{moveError}</AppText>}
              </View>
            }
            ListEmptyComponent={
              <AppText style={{ color: colors.inkMuted, textAlign: "center", padding: 16 }}>
                이 폴더엔 아직 저장한 장소가 없어요.
              </AppText>
            }
            renderItem={({ item }: { item: Bookmark }) => (
              <Pressable
                onPress={() => setReviewPlaceId(item.placeId)}
                style={{
                  flexDirection: "row",
                  gap: 8,
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                    <AppText weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {item.placeName}
                    </AppText>
                    {item.category && (
                      <AppText style={{ fontSize: 12, color: colors.inkMuted }} numberOfLines={1}>
                        {item.category}
                      </AppText>
                    )}
                  </View>
                  {item.address && (
                    <AppText style={{ fontSize: 12, color: colors.inkMuted }} numberOfLines={1}>
                      {item.address}
                    </AppText>
                  )}
                </View>
                <Pressable onPress={() => setMenuBookmarkId(item.id)} hitSlop={10} style={{ paddingHorizontal: 4 }}>
                  <AppText style={{ fontSize: 16, color: colors.inkMuted }}>⋮</AppText>
                </Pressable>
              </Pressable>
            )}
          />
        )}
        </BottomSheet>
      </View>

      <FolderPickerModal
        visible={folderPickerTarget !== null}
        onClose={() => setFolderPickerTarget(null)}
        onPick={handlePickFolder}
      />

      <Modal
        visible={menuBookmark !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuBookmarkId(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end" }}
          onPress={() => setMenuBookmarkId(null)}
        >
          <Pressable
            style={{ backgroundColor: colors.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 8 }}
            onPress={(e) => e.stopPropagation()}
          >
            <AppText weight="medium" numberOfLines={1} style={{ padding: 12, color: colors.inkMuted, fontSize: 13 }}>
              {menuBookmark?.placeName}
            </AppText>
            <Pressable
              onPress={() => {
                if (!menuBookmark) return;
                const bookmarkId = menuBookmark.id;
                setMenuBookmarkId(null);
                setFolderPickerTarget({ mode: "move", bookmarkId });
              }}
              style={{ padding: 14 }}
            >
              <AppText>다른 폴더로 이동</AppText>
            </Pressable>
            <Pressable
              onPress={() => {
                if (!menuBookmark) return;
                const bookmarkId = menuBookmark.id;
                setMenuBookmarkId(null);
                handleRemove(bookmarkId);
              }}
              style={{ padding: 14 }}
            >
              <AppText style={{ color: colors.accent }}>찜 해제</AppText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
