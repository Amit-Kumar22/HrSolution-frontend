import { useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Field } from "../components/ui";
import { colors } from "../constants/theme";
import { apiMessage } from "../services/api";
import { useAuth } from "../hooks/useAuth";

const WORKER_EMAIL = "worker@gmail.com";
const WORKER_PASSWORD = "Worker@123";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState(WORKER_EMAIL);
  const [password, setPassword] = useState(WORKER_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function fillWorkerDemo() {
    setEmail(WORKER_EMAIL);
    setPassword(WORKER_PASSWORD);
    setError("");
  }

  async function submit() {
    const normalizedEmail = email.trim().toLowerCase();
    setError("");
    if (!normalizedEmail || !normalizedEmail.includes("@")) return setError("Enter a valid email address.");
    if (!password) return setError("Enter your password.");

    setBusy(true);
    try {
      await signIn(normalizedEmail, password);
      router.replace("/(tabs)");
    } catch (loginError) {
      setError(apiMessage(loginError, loginError instanceof Error ? loginError.message : "Sign in failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <Image source={require("../assets/logo2.png")} style={styles.brandLogo} resizeMode="contain" alt="Shakti Manpower" />
          <View>
            <Text style={styles.brandName}>Shakti Manpower</Text>
            <Text style={styles.brandCaption}>HR SOLUTIONS PORTAL</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.eyebrow}>WORKER PORTAL</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Log in to access your workforce information, documents and updates.</Text>

          <Field label="Email address" value={email} onChangeText={setEmail} placeholder="name@company.com" keyboardType="email-address" />
          <Field label="Password" value={password} onChangeText={setPassword} placeholder="Enter your password" secureTextEntry={!showPassword} />

          <Pressable onPress={() => setShowPassword((visible) => !visible)} style={styles.showPassword}>
            <Text style={styles.showPasswordText}>{showPassword ? "Hide password" : "Show password"}</Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable disabled={busy} onPress={submit} style={[styles.loginButton, busy && styles.disabled]}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.loginButtonText}>Log in</Text>}
          </Pressable>

          <View style={styles.demoPanel}>
            <Text style={styles.demoTitle}>Worker demo account</Text>
            <Pressable onPress={fillWorkerDemo} style={({ pressed }) => [styles.demoButton, pressed && styles.demoButtonPressed]}>
              <Text style={styles.demoRole}>Worker</Text>
              <View style={styles.demoCredentials}>
                <Text style={styles.demoEmail}>{WORKER_EMAIL}</Text>
                <Text style={styles.demoPassword}>{WORKER_PASSWORD}</Text>
              </View>
            </Pressable>
            <Text style={styles.demoHint}>Tap to auto-fill email and password</Text>
          </View>
        </View>

        <Text style={styles.secureText}>Secure sign-in · Sessions rotate automatically</Text>
        <Text style={styles.footer}>© 2026 Shakti Manpower Services Pvt. Ltd.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 22 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 28 },
  brandLogo: { width: 58, height: 58, borderRadius: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  brandName: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  brandCaption: { color: "#8496ad", fontSize: 9, fontWeight: "700", letterSpacing: 1.3, marginTop: 2 },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 20 },
  eyebrow: { color: colors.amberDark, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 8 },
  title: { color: colors.ink, fontSize: 28, fontWeight: "800", letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 22 },
  showPassword: { alignSelf: "flex-end", marginTop: -6, marginBottom: 10 },
  showPasswordText: { color: colors.amberDark, fontSize: 11, fontWeight: "700" },
  error: { color: colors.danger, backgroundColor: "#fee5e5", borderRadius: 8, padding: 11, fontSize: 11, lineHeight: 16, marginBottom: 12 },
  loginButton: { minHeight: 44, borderRadius: 8, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center", marginTop: 2 },
  loginButtonText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.65 },
  demoPanel: { marginTop: 20, padding: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 9, backgroundColor: colors.bg },
  demoTitle: { color: "#29415e", fontSize: 11, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 9 },
  demoButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 9, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 6, backgroundColor: colors.white },
  demoButtonPressed: { borderColor: colors.ink, backgroundColor: colors.pale },
  demoRole: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  demoCredentials: { alignItems: "flex-end", flexShrink: 1 },
  demoEmail: { color: colors.muted, fontSize: 10 },
  demoPassword: { color: colors.amberDark, fontSize: 10, fontWeight: "700", marginTop: 2 },
  demoHint: { color: "#9aa8b9", fontSize: 10, textAlign: "center", marginTop: 8 },
  secureText: { color: "#8b9bb0", fontSize: 10, textAlign: "center", marginTop: 17 },
  footer: { color: "#97a5b7", fontSize: 10, textAlign: "center", marginTop: 22 },
});
