import { useEffect, useState } from "react";
import {
  AppState,
  Button,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  SPEECH_DEBUG_SESSION_ID,
  speechDebugStatus,
} from "@kasama/shared";
import { useKasamaConversation } from "../hooks/useKasamaConversation";

type Props = {
  onBack: () => void;
};

/**
 * Temporary speech probe (#17). Record → `POST /speech/transcribe` →
 * `POST /conversation/turn` → play the reply (ElevenLabs or iOS speech).
 * No designed chrome. Hidden behind Home → Dev. Uses `speech-debug` so it
 * cannot overwrite the iOS `default` session.
 */
export function SpeechDebugScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { state, pressMic, submitText, openSettings, recheckMic } =
    useKasamaConversation(SPEECH_DEBUG_SESSION_ID);
  const [draft, setDraft] = useState("");
  const status = speechDebugStatus({
    phase: state.phase,
    notice: state.notice,
    seniorText: state.seniorText,
    kasamaText: state.kasamaText,
  });

  useEffect(() => {
    if (state.phase !== "micDenied") return;
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void recheckMic();
    });
    return () => sub.remove();
  }, [recheckMic, state.phase]);

  const sendTyped = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void submitText(text);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.kicker}>Speech debug (temporary)</Text>
      <Text style={styles.meta}>
        Record, send the transcript to Kasama, play the reply. Mic denial stays on
        this screen. Hidden once the designed voice loop is enough.
      </Text>

      <Text style={styles.title}>{status.title}</Text>
      {status.body ? <Text style={styles.body}>{status.body}</Text> : null}

      {state.seniorText && state.phase !== "thinking" ? (
        <Text style={styles.quote}>You said: “{state.seniorText}”</Text>
      ) : null}
      {state.kasamaText && state.phase !== "speaking" ? (
        <Text style={styles.quote}>Kasama: {state.kasamaText}</Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          title={status.recordLabel}
          disabled={!status.recordEnabled}
          onPress={() => void pressMic()}
        />
        {status.showSettings ? (
          <Button title="Open Settings" onPress={openSettings} />
        ) : null}
      </View>

      <TextInput
        style={styles.input}
        value={draft}
        onChangeText={setDraft}
        placeholder="Type if the mic is off"
        placeholderTextColor="#666"
        editable={state.phase !== "listening" && state.phase !== "thinking"}
        onSubmitEditing={sendTyped}
        returnKeyType="send"
        accessibilityLabel="Type what you need"
      />
      <Button
        title="Send text"
        disabled={state.phase === "listening" || state.phase === "thinking"}
        onPress={sendTyped}
      />

      <View style={styles.back}>
        <Button title="Back" onPress={onBack} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    gap: 12,
  },
  kicker: {
    fontSize: 16,
    color: "#666",
  },
  meta: {
    fontSize: 16,
    color: "#333",
  },
  title: {
    fontSize: 28,
    color: "#111",
    marginTop: 8,
  },
  body: {
    fontSize: 22,
    color: "#111",
  },
  quote: {
    fontSize: 20,
    color: "#333",
  },
  actions: {
    gap: 8,
    alignItems: "flex-start",
  },
  input: {
    borderWidth: 1,
    borderColor: "#111",
    fontSize: 22,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
  },
  back: {
    marginTop: "auto",
  },
});
