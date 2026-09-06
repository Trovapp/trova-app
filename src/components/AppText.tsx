import { Text, type TextProps } from "react-native";

export function AppText({
  weight = "regular",
  style,
  ...props
}: TextProps & { weight?: "regular" | "medium" }) {
  const fontFamily = weight === "medium" ? "IBMPlexMono_500Medium" : "IBMPlexMono_400Regular";
  return <Text style={[{ fontFamily }, style]} {...props} />;
}
