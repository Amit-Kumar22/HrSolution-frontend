import RoleDashboard from "@/components/role-dashboard";
import SupervisorOverview from "@/components/supervisor-overview";
import "./supervisor.css";

export const metadata = {
  title: "Supervisor Dashboard | Shakti Manpower",
  description: "Supervisor workspace for site supervision and workforce allocation.",
};

export default function SupervisorPage() {
  return (
    <RoleDashboard
      allowedRoles={["SUPERVISOR", "SITE_SUPERVISOR"]}
      dashboardName="Supervisor Dashboard"
      description="Your supervision workspace. You only see the modules and actions granted to your role."
      variant="Supervisor"
      overview={SupervisorOverview}
    />
  );
}
