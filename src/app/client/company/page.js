import ClientDashboard from "@/components/client-dashboard";
import "../client.css";

export const metadata = {
  title: "Company Profile | Shakti Manpower",
  description: "Registration, statutory and billing details for your company.",
};

export default function ClientCompanyPage() {
  return <ClientDashboard initialView="company-profile" />;
}
