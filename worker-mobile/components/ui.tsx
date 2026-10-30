import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, shadow } from "../constants/theme";
import { useAuth } from "../hooks/useAuth";

export function AppHeader() {
  const { session } = useAuth();
  const user = session?.user || {};
  const displayName = user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Worker";
  const initials = displayName.split(/\s+/).map((part: string) => part[0]).slice(0, 2).join("").toUpperCase();
  return <View style={styles.header}>
    <View style={styles.headerBrand}>
      <Image source={require("../assets/logo2.png")} style={styles.headerLogo} resizeMode="contain" alt="Shakti Manpower" />
      <View style={styles.headerBrandCopy}><Text style={styles.headerTitle}>Shakti Manpower</Text><Text style={styles.headerCaption}>WORKER PORTAL</Text></View>
    </View>
    <View style={styles.headerActions}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
    </View>
  </View>;
}
export function Screen({ children, title, subtitle }: { children: React.ReactNode; title?: string; subtitle?: string }) { return <View style={styles.screen}><AppHeader /><View style={styles.screenBody}>{title && <><Text style={styles.title}>{title}</Text>{subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}</>}{children}</View></View>; }
export function Card({ children }: { children: React.ReactNode }) { return <View style={styles.card}>{children}</View>; }
export function State({ loading, error, empty = "Nothing to show yet.", onRetry }: { loading?: boolean; error?: string; empty?: string; onRetry?: () => void }) { if (loading) return <View style={styles.state}><ActivityIndicator color={colors.blue} /><Text style={styles.muted}>Loading…</Text></View>; if (error) return <View style={styles.state}><Text style={styles.error}>{error}</Text>{onRetry && <Button title="Try again" onPress={onRetry} outline />}</View>; return <View style={styles.state}><Text style={styles.muted}>{empty}</Text></View>; }
export function Button({ title, onPress, outline, disabled }: { title: string; onPress: () => void; outline?: boolean; disabled?: boolean }) { return <Pressable disabled={disabled} onPress={onPress} style={[styles.button, outline && styles.outline, disabled && styles.disabled]}><Text style={[styles.buttonText, outline && styles.outlineText]}>{title}</Text></Pressable>; }
export function Field({ label, value, onChangeText, secureTextEntry, placeholder, keyboardType = "default" }: any) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} secureTextEntry={secureTextEntry} placeholder={placeholder} placeholderTextColor="#9aaabc" keyboardType={keyboardType} autoCapitalize="none" style={styles.input} /></View>; }
export const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
  screenBody: { padding: 20, paddingBottom: 32 },
  header: { minHeight: 76, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, backgroundColor: colors.navy, borderBottomWidth: 1, borderBottomColor: colors.navyDeep },
  headerBrand: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  headerLogo: { width: 54, height: 54, borderRadius: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  headerBrandCopy: { flexShrink: 1 },
  headerTitle: { color: colors.white, fontSize: 15, fontWeight: "800" },
  headerCaption: { color: "#c8d8e9", fontSize: 10, letterSpacing: 1.2, marginTop: 3 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.amber, borderWidth: 2, borderColor: colors.amberDark },
  avatarText: { color: colors.navyDeep, fontSize: 11, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 27, fontWeight: "800", marginBottom: 5 },
  subtitle: { color: colors.muted, lineHeight: 21, marginBottom: 18 },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16, marginBottom: 14, ...shadow },
  state: { alignItems: "center", gap: 10, padding: 30 },
  muted: { color: colors.muted, textAlign: "center" },
  error: { color: colors.danger, textAlign: "center", marginBottom: 12 },
  button: { backgroundColor: colors.blue, borderRadius: 8, padding: 14, alignItems: "center", marginTop: 8 },
  buttonText: { color: colors.white, fontWeight: "800" },
  outline: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.blue },
  outlineText: { color: colors.blue },
  disabled: { opacity: 0.55 },
  field: { marginBottom: 14 },
  label: { color: colors.ink, fontWeight: "700", marginBottom: 7 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 13, color: colors.ink },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  section: { color: colors.ink, fontSize: 18, fontWeight: "800", marginBottom: 10 },
  badge: { color: colors.blue, backgroundColor: colors.pale, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, overflow: "hidden", fontSize: 12, fontWeight: "700" },
});
