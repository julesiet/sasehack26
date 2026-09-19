import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CaretakerScreen } from "./src/screens/CaretakerScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { SeniorScreen } from "./src/screens/SeniorScreen";

type Screen = "home" | "senior" | "caretaker";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");

  return (
    <SafeAreaProvider>
      {screen === "home" ? (
        <HomeScreen
          onOpenSenior={() => setScreen("senior")}
          onOpenCaretaker={() => setScreen("caretaker")}
        />
      ) : null}
      {screen === "senior" ? (
        <SeniorScreen onBack={() => setScreen("home")} />
      ) : null}
      {screen === "caretaker" ? (
        <CaretakerScreen onBack={() => setScreen("home")} onOpenSenior={() => setScreen("senior")} />
      ) : null}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
