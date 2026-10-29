import { ScrollView, Text } from "react-native";
import { Screen, Card, styles } from "../../components/ui";
export default function Payslips() { return <ScrollView><Screen title="My payslips" subtitle="Salary statements issued for your processed payroll periods."><Card><Text style={styles.section}>No payslip endpoint is available</Text><Text style={styles.muted}>The existing project currently shows a placeholder because the backend does not expose a worker payslip list, detail, or download contract. No fake salary data is shown.</Text></Card></Screen></ScrollView>; }
