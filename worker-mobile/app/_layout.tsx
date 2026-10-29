import { Stack, usePathname, useRouter } from "expo-router";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Text, View } from "react-native";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../hooks/useAuth";

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Worker app failed to render", error, info.componentStack); }
  render() {
    if (this.state.error) return <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#f6f8fb" }}><Text style={{ fontSize: 20, fontWeight: "800", color: "#132238", marginBottom: 8 }}>Worker app could not open</Text><Text style={{ color: "#65758b" }}>Please reload the Expo project. If the problem continues, restart it with the latest QR code.</Text></View>;
    return this.props.children;
  }
}

function AuthGuard() { const { session, loading } = useAuth(); const pathname = usePathname(); const router = useRouter(); useEffect(() => { if (!loading && !session && pathname !== "/" && pathname !== "/login") router.replace("/login"); }, [loading, session, pathname, router]); return <Stack screenOptions={{ headerShown: false }} />; }
export default function RootLayout() { return <AppErrorBoundary><AuthProvider><AuthGuard /></AuthProvider></AppErrorBoundary>; }
