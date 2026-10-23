import ClientDashboard from "@/components/client-dashboard";
import "../../client.css";

export const instant = false;

export const metadata = {
  title: "Site Details | Shakti Manpower",
  description: "Address, in-charge and status details for a site.",
};

export default async function ClientSiteDetailsPage({ params }) {
  const { siteId } = await params;
  return <ClientDashboard initialView="site-details" siteId={siteId} />;
}
