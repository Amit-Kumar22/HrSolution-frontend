import ClientDashboard from "@/components/client-dashboard";
import "../client.css";

export const metadata = {
  title: "My Contracts | Shakti Manpower",
  description: "Review your company's contracts and commercial terms.",
};

export default function ClientContractsPage() {
  return <ClientDashboard initialView="contracts" />;
}
