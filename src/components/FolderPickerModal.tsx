import { useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText } from "@/components/AppText";
import { DISTINCT_COLORS } from "@/lib/colorPresets";
import { createFolder, listFolders } from "@/lib/api/bookmarks";
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

  function reset() {
    setCreating(false);
    setNewName("");
    setNewColor(DISTINCT_COLORS[0]);
  }

  async function handleCreateAndPick() {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      const folder = await createFolder(newName.trim(), newColor);
      await queryClient.invalidateQueries({ queryKey: ["bookmarkFolders"] });
      reset();
      onPick(folder.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={reset}
    >
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end" }} onPress={onClose}>
        <Pressable
          style={{ maxHeight: "70%", backgroundColor: colors.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
            <AppText weight="medium" style={{ fontSize: 16 }}>
              어느 폴더에 저장할까요?
            </AppText>

            <Pressable
              onPress={() => onPick(null)}
              style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
            >
              <AppText>미분류로 저장</AppText>
            </Pressable>

            {(foldersQuery.data ?? []).map((folder) => (
              <Pressable
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
              </Pressable>
            ))}

            {creating ? (
              <View style={{ gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                <TextInput
                  autoFocus
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="새 폴더 이름"
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
                    <Pressable
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
                <Pressable
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
                  <AppText weight="medium" style={{ color: "#fff" }}>
                    만들고 저장
                  </AppText>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setCreating(true)}
                style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed" }}
              >
                <AppText style={{ color: colors.accent }}>+ 새 폴더 만들기</AppText>
              </Pressable>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
