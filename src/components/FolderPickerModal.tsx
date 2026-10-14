import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { SheetTextInput } from "@/components/SheetTextInput";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, MAX_FONT_SCALE } from "@/components/AppText";
import { ErrorText } from "@/components/ErrorText";
import { PressableScale } from "@/components/PressableScale";
import { QueryErrorView } from "@/components/QueryErrorView";
import { DISTINCT_COLORS } from "@/lib/colorPresets";
import { createFolder, FOLDER_NAME_MAX_LENGTH, listFolders } from "@/lib/api/bookmarks";
import { colors, fontSize, radius, space } from "@/lib/theme";

export function FolderPickerModal({
  visible,
  onClose,
  onPick,
  createOnly = false,
}: {
  visible: boolean;
  onClose: () => void;
  // 폴더를 고르거나(기존 폴더 id) 미분류로 저장(null)하면 호출된다.
  // 실제 addBookmark/moveBookmarkToFolder 호출은 이 컴포넌트를 쓰는 화면의 책임.
  onPick: (folderId: number | null) => void;
  // 찜한 장소 화면의 "+ 새 폴더"처럼 저장할 장소 없이 폴더만 만들 때. 예전엔 같은 창이라
  // "어느 폴더에 저장할까요? / 미분류로 저장"이 떠 무엇을 하는 창인지 헷갈렸다(2026-10-13 PWA QA).
  createOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const foldersQuery = useQuery({ queryKey: ["bookmarkFolders"], queryFn: listFolders, enabled: visible });
  const [creating, setCreating] = useState(createOnly);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(DISTINCT_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ref = useRef<BottomSheetModal>(null);
  // 열려 있지 않은 시트에 dismiss()를 부르면(화면이 처음 그려질 때 visible=false, 또는 이미 닫힌 뒤) 뒤의 present()가
  // 무시돼 시트가 뜨지 않았다(2026-10-04 QA — 찜 폴더 이동). 지금 열려 있을 때만 닫는다(여행 상세 ⋮ 메뉴와 같은 원인).
  const presented = useRef(false);
  useEffect(() => {
    if (visible) {
      presented.current = true;
      ref.current?.present();
    } else if (presented.current) {
      presented.current = false;
      ref.current?.dismiss();
    }
  }, [visible]);

  // 폴더만 만드는 창은 열릴 때부터 이름 입력을 보여 준다.
  useEffect(() => {
    if (visible) setCreating(createOnly);
  }, [visible, createOnly]);

  function reset() {
    setCreating(createOnly);
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
        // 드래그·바깥 탭으로 이미 닫혔다 — effect가 닫힌 시트에 dismiss()를 다시 부르지 않게 표시를 지운다.
        presented.current = false;
        reset();
        onClose();
      }}
      backdropComponent={(props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
      )}
      backgroundStyle={{ backgroundColor: colors.bg }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: space.xxl }}>
        <AppText weight="medium" style={{ fontSize: fontSize.callout }}>
          {createOnly ? "새 폴더 만들기" : "어느 폴더에 저장할까요?"}
        </AppText>

        {!createOnly && (
          <PressableScale
            onPress={() => onPick(null)}
            style={{ padding: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}
          >
            <AppText>미분류로 저장</AppText>
          </PressableScale>
        )}

        {!createOnly && foldersQuery.isLoading && (
          <AppText style={{ color: colors.inkMuted, textAlign: "center" }}>불러오는 중...</AppText>
        )}

        {!createOnly && foldersQuery.isError && (
          <QueryErrorView message="폴더 목록을 불러오지 못했어요." onRetry={() => foldersQuery.refetch()} />
        )}

        {!createOnly &&
          !foldersQuery.isLoading &&
          !foldersQuery.isError &&
          (foldersQuery.data ?? []).map((folder) => (
            <PressableScale
              key={folder.id}
              onPress={() => onPick(folder.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.sm,
                padding: space.sm,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ width: 12, height: 12, borderRadius: radius.full, backgroundColor: folder.color }} />
              <AppText style={{ flex: 1 }}>{folder.name}</AppText>
              <AppText style={{ fontSize: fontSize.caption1, color: colors.inkMuted }}>{folder.placeCount}개</AppText>
            </PressableScale>
          ))}

        {error && <ErrorText>{error}</ErrorText>}

        {creating ? (
          <View style={{ gap: space.sm, padding: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}>
            <SheetTextInput underlineColorAndroid="transparent"
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              autoFocus
              value={newName}
              onChangeText={setNewName}
              placeholderTextColor={colors.inkMuted}
              placeholder="새 폴더 이름"
              maxLength={FOLDER_NAME_MAX_LENGTH}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.sm,
                paddingHorizontal: space.sm,
                paddingVertical: space.xs,
                fontSize: fontSize.subheadline,
              }}
            />
            <View style={{ flexDirection: "row", gap: space.xs }}>
              {DISTINCT_COLORS.map((color) => (
                <PressableScale
                  key={color}
                  onPress={() => setNewColor(color)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: radius.md,
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
                borderRadius: radius.sm,
                backgroundColor: colors.accent,
                justifyContent: "center",
                alignItems: "center",
                opacity: !newName.trim() || busy ? 0.5 : 1,
              }}
            >
              <AppText weight="medium" style={{ color: colors.onAccent }}>
                {createOnly ? "만들기" : "만들고 저장"}
              </AppText>
            </PressableScale>
          </View>
        ) : (
          <PressableScale
            onPress={() => setCreating(true)}
            style={{ padding: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed" }}
          >
            <AppText style={{ color: colors.accent }}>+ 새 폴더 만들기</AppText>
          </PressableScale>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
