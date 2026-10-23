import ClientDashboard from "@/components/client-dashboard";
import "../client.css";

export const metadata = {
  title: "Client Account Settings | Shakti Manpower",
  description: "Review your client profile and account information.",
};

export default function ClientAccountPage() {
  return <ClientDashboard initialView="account-settings" />;
}
