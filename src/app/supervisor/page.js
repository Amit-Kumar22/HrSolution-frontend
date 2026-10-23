import RoleDashboard from "@/components/role-dashboard";
import SupervisorOverview from "@/components/supervisor-overview";
import "../operator/operator.css";

export const metadata = {
  title: "Supervisor Dashboard | Shakti Manpower",
  description: "Supervisor workspace for site supervision and workforce allocation.",
};

export default function SupervisorPage() {
  return (
    <RoleDashboard
      allowedRoles={["SUPERVISOR"]}
      dashboardName="Supervisor Dashboard"
      description="Your supervision workspace. You only see the modules and actions granted to your role."
      variant="Operator"
      overview={SupervisorOverview}
    />
  );
}
