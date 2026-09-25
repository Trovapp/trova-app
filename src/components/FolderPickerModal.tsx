import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, MAX_FONT_SCALE } from "@/components/AppText";
import { ErrorText } from "@/components/ErrorText";
import { PressableScale } from "@/components/PressableScale";
import { QueryErrorView } from "@/components/QueryErrorView";
import { DISTINCT_COLORS } from "@/lib/colorPresets";
import { createFolder, FOLDER_NAME_MAX_LENGTH, listFolders } from "@/lib/api/bookmarks";
import { haptics } from "@/lib/haptics";
import { colors } from "@/lib/theme";

export function FolderPickerModal({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  // 폴더를 고르거나(기존 폴더 id) 미분류로 저장(null)하면 호출된다.
  // 실제 addBookmark/moveBookmarkToFolder 호출은 이 컴포넌트를 쓰는 화면의 책임.
  onPick: (folderId: number | null) => void;
}) {
  const queryClient = useQueryClient();
  const foldersQuery = useQuery({ queryKey: ["bookmarkFolders"], queryFn: listFolders, enabled: visible });
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(DISTINCT_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ref = useRef<BottomSheetModal>(null);
  useEffect(() => {
    if (visible) {
      ref.current?.present();
    } else {
      ref.current?.dismiss();
    }
  }, [visible]);

  function reset() {
    setCreating(false);
    setNewName("");
    setNewColor(DISTINCT_COLORS[0]);
    setError(null);
  }

  async function handleCreateAndPick() {
    if (!newName.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const folder = await createFolder(newName.trim(), newColor);
      await queryClient.invalidateQueries({ queryKey: ["bookmarkFolders"] });
      reset();
      onPick(folder.id);
    } catch {
      setError("폴더를 만들지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={["70%"]}
      onDismiss={() => {
        haptics.light();
        reset();
        onClose();
      }}
      backdropComponent={(props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
      )}
      backgroundStyle={{ backgroundColor: colors.bg }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 32 }}>
        <AppText weight="medium" style={{ fontSize: 16 }}>
          어느 폴더에 저장할까요?
        </AppText>

        <PressableScale
          onPress={() => onPick(null)}
          style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
        >
          <AppText>미분류로 저장</AppText>
        </PressableScale>

        {foldersQuery.isLoading && (
          <AppText style={{ color: colors.inkMuted, textAlign: "center" }}>불러오는 중...</AppText>
        )}

        {foldersQuery.isError && (
          <QueryErrorView message="폴더 목록을 불러오지 못했어요." onRetry={() => foldersQuery.refetch()} />
        )}

        {!foldersQuery.isLoading &&
          !foldersQuery.isError &&
          (foldersQuery.data ?? []).map((folder) => (
            <PressableScale
              key={folder.id}
              onPress={() => onPick(folder.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: folder.color }} />
              <AppText style={{ flex: 1 }}>{folder.name}</AppText>
              <AppText style={{ fontSize: 12, color: colors.inkMuted }}>{folder.placeCount}개</AppText>
            </PressableScale>
          ))}

        {error && <ErrorText>{error}</ErrorText>}

        {creating ? (
          <View style={{ gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
            <BottomSheetTextInput
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              autoFocus
              value={newName}
              onChangeText={setNewName}
              placeholder="새 폴더 이름"
              maxLength={FOLDER_NAME_MAX_LENGTH}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 8,
                fontSize: 14,
              }}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              {DISTINCT_COLORS.map((color) => (
                <PressableScale
                  key={color}
                  onPress={() => setNewColor(color)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: color,
                    borderWidth: newColor === color ? 3 : 0,
                    borderColor: colors.ink,
                  }}
                />
              ))}
            </View>
            <PressableScale
              onPress={handleCreateAndPick}
              disabled={!newName.trim() || busy}
              style={{
                height: 40,
                borderRadius: 8,
                backgroundColor: colors.accent,
                justifyContent: "center",
                alignItems: "center",
                opacity: !newName.trim() || busy ? 0.5 : 1,
              }}
            >
              <AppText weight="medium" style={{ color: colors.onAccent }}>
                만들고 저장
              </AppText>
            </PressableScale>
          </View>
        ) : (
          <PressableScale
            onPress={() => setCreating(true)}
            style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed" }}
          >
            <AppText style={{ color: colors.accent }}>+ 새 폴더 만들기</AppText>
          </PressableScale>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
