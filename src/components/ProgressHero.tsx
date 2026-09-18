import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { colors } from "@/lib/theme";

type Card = { icon: keyof typeof Feather.glyphMap; color: string };

const DEFAULT_CARDS: Card[] = [
  { icon: "compass", color: colors.accent },
  { icon: "map", color: "#3B7A6E" },
  { icon: "camera", color: "#D9A441" },
  { icon: "map-pin", color: "#4A6FA5" },
  { icon: "briefcase", color: "#8C5E58" },
];

const CARD_SIZE = 72;
const CARD_GAP = 12;
const MS_PER_CARD = 1800;

function ProgressCard({ icon, color }: Card) {
  return (
    <View
      style={{
        width: CARD_SIZE,
        height: CARD_SIZE,
        marginRight: CARD_GAP,
        borderRadius: 18,
        backgroundColor: `${color}26`,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Feather name={icon} size={28} color={color} />
    </View>
  );
}

// 실제 후보 장소 사진 대신, 여행 테마 아이콘 카드가 옆으로 끊임없이 흘러가는
// 연출로 대기 화면에 움직임을 준다 — 세트를 두 번 이어붙이고 첫 번째 세트
// 폭만큼 translateX를 반복시켜서 이음매 없이 무한히 흐르는 것처럼 보이게 한다.
export function ProgressHero({ percent, cards = DEFAULT_CARDS }: { percent: number; cards?: Card[] }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [setWidth, setSetWidth] = useState(0);

  useEffect(() => {
    if (setWidth === 0) return;
    translateX.setValue(0);
    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: -setWidth,
        duration: cards.length * MS_PER_CARD,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [setWidth, cards.length, translateX]);

  return (
    <View style={{ width: "100%", alignItems: "center", gap: 20 }}>
      <AppText weight="medium" style={{ fontSize: 48, color: colors.accent }}>
        {percent}%
      </AppText>
      <View style={{ width: "100%", height: CARD_SIZE, overflow: "hidden" }}>
        <Animated.View
          style={{ flexDirection: "row", transform: [{ translateX }] }}
          onLayout={(e) => {
            if (setWidth === 0) setSetWidth(e.nativeEvent.layout.width / 2);
          }}
        >
          {[...cards, ...cards].map((card, i) => (
            <ProgressCard key={i} icon={card.icon} color={card.color} />
          ))}
        </Animated.View>
      </View>
    </View>
  );
}
