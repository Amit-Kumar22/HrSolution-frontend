import ClientDashboard from "@/components/client-dashboard";
import "../client.css";

export const metadata = {
  title: "Users | Shakti Manpower",
  description: "People at your company who can access the client portal.",
};

export default function ClientUsersPage() {
  return <ClientDashboard initialView="users" />;
}
