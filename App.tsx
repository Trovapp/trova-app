import { useEffect } from "react";
import { useFonts as useMonoFonts, IBMPlexMono_400Regular, IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono";
import { useFonts as useSansFonts, NotoSansKR_400Regular, NotoSansKR_500Medium } from "@expo-google-fonts/noto-sans-kr";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { RootNavigator } from "@/navigation/RootNavigator";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

export default function App() {
  const [monoFontsLoaded] = useMonoFonts({
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });
  const [sansFontsLoaded] = useSansFonts({
    NotoSansKR_400Regular,
    NotoSansKR_500Medium,
  });
  const fontsLoaded = monoFontsLoaded && sansFontsLoaded;

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SafeAreaProvider>
            <StatusBar style="dark" />
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </SafeAreaProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
