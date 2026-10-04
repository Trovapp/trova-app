import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList } from "./types";

// 화면 밖(공유 받기 등)에서 화면을 옮길 때 쓴다.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
