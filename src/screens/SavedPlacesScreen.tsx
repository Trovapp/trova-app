import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import BottomSheet, { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { InlineMap } from "@/components/InlineMap";
import { QueryErrorView } from "@/components/QueryErrorView";
import { listBookmarks, listFolders, removeBookmark, type Bookmark, type BookmarkFolder } from "@/lib/api/bookmarks";
import { colors } from "@/lib/theme";

const UNSORTED_ID = -1; // "미분류" 가상 폴더 id — 실제 폴더 id는 항상 양수(DB IDENTITY)라 겹치지 않는다.

export function SavedPlacesScreen() {
  const bookmarksQuery = useQuery({ queryKey: ["bookmarks"], queryFn: listBookmarks });
  const foldersQuery = useQuery({ queryKey: ["bookmarkFolders"], queryFn: listFolders });
  const queryClient = useQueryClient();
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null); // null = 폴더 목록 보기
  const [removeError, setRemoveError] = useState<string | null>(null);
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

  const pins = visibleBookmarks
    .filter((b) => b.latitude !== null && b.longitude !== null)
    .map((b) => ({
      id: String(b.id),
      latitude: b.latitude as number,
      longitude: b.longitude as number,
      color: b.folderId !== null ? folderColorById.get(b.folderId) : colors.inkMuted,
    }));

  const unsortedCount = bookmarks.filter((b) => b.folderId === null).length;

  async function handleRemove(id: number) {
    setRemoveError(null);
    try {
      await removeBookmark(id);
      await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    } catch {
      setRemoveError("장소를 제거하지 못했어요.");
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <InlineMap pins={pins} fill showPath={false} />

      <BottomSheet index={1} snapPoints={snapPoints} enableDynamicSizing={false}>
        {activeFolderId === null ? (
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
                <Pressable onPress={() => setActiveFolderId(null)}>
                  <AppText style={{ color: colors.accent }}>← 폴더 목록</AppText>
                </Pressable>
                {removeError && <AppText style={{ color: colors.accent }}>{removeError}</AppText>}
              </View>
            }
            ListEmptyComponent={
              <AppText style={{ color: colors.inkMuted, textAlign: "center", padding: 16 }}>
                이 폴더엔 아직 저장한 장소가 없어요.
              </AppText>
            }
            renderItem={({ item }: { item: Bookmark }) => (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <AppText style={{ flex: 1 }} numberOfLines={1}>
                  {item.placeName}
                </AppText>
                <Pressable onPress={() => handleRemove(item.id)}>
                  <AppText style={{ fontSize: 12, color: colors.inkMuted }}>제거</AppText>
                </Pressable>
              </View>
            )}
          />
        )}
      </BottomSheet>
    </View>
  );
}
