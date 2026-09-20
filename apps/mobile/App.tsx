import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CaretakerScreen } from "./src/screens/CaretakerScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { SeniorScreen } from "./src/screens/SeniorScreen";
import { SpeechDebugScreen } from "./src/screens/SpeechDebugScreen";

type Screen = "home" | "senior" | "caretaker" | "speechDebug";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");

  return (
    <SafeAreaProvider>
      {screen === "home" ? (
        <HomeScreen
          onOpenSenior={() => setScreen("senior")}
          onOpenCaretaker={() => setScreen("caretaker")}
          onOpenSpeechDebug={() => setScreen("speechDebug")}
        />
      ) : null}
      {screen === "senior" ? (
        <SeniorScreen onBack={() => setScreen("home")} />
      ) : null}
      {screen === "caretaker" ? (
        <CaretakerScreen onBack={() => setScreen("home")} onOpenSenior={() => setScreen("senior")} />
      ) : null}
      {screen === "speechDebug" ? (
        <SpeechDebugScreen onBack={() => setScreen("home")} />
      ) : null}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
