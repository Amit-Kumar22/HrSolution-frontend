import { ScrollView, Text } from "react-native";
import { Screen, Card, styles } from "../../components/ui";
export default function Attendance() { return <ScrollView><Screen title="Attendance" subtitle="Your attendance records and daily status."><Card><Text style={styles.section}>Unavailable from current backend</Text><Text style={styles.muted}>The existing API exposes management attendance sheets only. It does not expose a worker-scoped attendance list or check-in/check-out contract, so this screen will not simulate records.</Text></Card></Screen></ScrollView>; }
