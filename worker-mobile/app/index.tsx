import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../hooks/useAuth";
export default function Index() { const { session, loading } = useAuth(); if (loading) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator /></View>; return <Redirect href={session ? "/(tabs)" : "/login"} />; }
