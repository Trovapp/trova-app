import { ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { PressableScale } from "@/components/PressableScale";
import { CATEGORY_GROUPS, categoryGroup, type CategoryGroup } from "@/lib/placeCategory";
import { colors, fontSize, radius, space } from "@/lib/theme";

// 결과 화면 분류 필터(2026-10). 참고: Plotline 모음 화면의 분류 칩(전체·구경·카페·숙소).
// 실제로 있는 분류만 보여주고, 분류가 한 가지뿐이면 칩 자체를 그리지 않는다.
export function presentGroups(categories: (string | null)[]): CategoryGroup[] {
  const present = new Set(categories.map(categoryGroup));
  return CATEGORY_GROUPS.map((g) => g.key).filter((k) => present.has(k));
}

export function CategoryFilterChips({
  categories,
  value,
  onChange,
}: {
  categories: (string | null)[];
  value: CategoryGroup | null;
  onChange: (next: CategoryGroup | null) => void;
}) {
  const groups = presentGroups(categories);
  if (groups.length < 2) return null;
  const counts = new Map<CategoryGroup, number>();
  categories.forEach((c) => counts.set(categoryGroup(c), (counts.get(categoryGroup(c)) ?? 0) + 1));

  const chips: { key: CategoryGroup | null; label: string; icon?: (typeof CATEGORY_GROUPS)[number]["icon"]; count: number }[] = [
    { key: null, label: "전체", count: categories.length },
    ...groups.map((key) => {
      const g = CATEGORY_GROUPS.find((x) => x.key === key)!;
      return { key, label: g.label, icon: g.icon, count: counts.get(key) ?? 0 };
    }),
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
      {chips.map((chip) => {
        const selected = chip.key === value;
        return (
          <PressableScale
            key={chip.label}
            onPress={() => onChange(chip.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.xxs,
              paddingVertical: space.xs,
              paddingHorizontal: space.sm,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: selected ? colors.ink : colors.border,
              backgroundColor: selected ? colors.ink : colors.bg,
            }}
          >
            {chip.icon && <MaterialCommunityIcons name={chip.icon} size={14} color={selected ? colors.onAccent : colors.inkMuted} />}
            <AppText weight={selected ? "medium" : "regular"} style={{ fontSize: fontSize.footnote, color: selected ? colors.onAccent : colors.ink }}>
              {chip.label} {chip.count}
            </AppText>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}
