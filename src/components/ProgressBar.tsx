import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

export function ProgressBar({ percent, height = 6 }: { percent: number; height?: number }) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: percent,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [percent, widthAnim]);

  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: "#EFEFEA", overflow: "hidden" }}>
      <Animated.View
        style={{
          height: "100%",
          borderRadius: height / 2,
          backgroundColor: "#FF6B4A",
          width: widthAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
        }}
      />
    </View>
  );
}
