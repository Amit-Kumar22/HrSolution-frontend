import ClientDashboard from "@/components/client-dashboard";
import "../client.css";

export const metadata = {
  title: "Sites | Shakti Manpower",
  description: "Sites registered for your company.",
};

export default function ClientSitesPage() {
  return <ClientDashboard initialView="sites" />;
}
