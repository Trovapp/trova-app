import { Linking } from "react-native";

export { kakaoMapUrl, phoneUrl } from "./placeLinkUrls";

export function openExternal(url: string) {
  Linking.openURL(url).catch(() => {});
}
