import RoleDashboard from "@/components/role-dashboard";
import OperatorOverview from "@/components/operator-overview";
import "./operator.css";

export const metadata = {
  title: "Operator Dashboard | Shakti Manpower",
  description: "Operator workspace for authorised day-to-day operations.",
};

export default function OperatorPage() {
  return (
    <RoleDashboard
      allowedRoles={["OPERATOR", "OPERATIONS", "OPERATIONS_MANAGER", "SECURITY_GUARD"]}
      dashboardName="Operator Dashboard"
      description="Your operations workspace. You only see the modules and actions granted to your role."
      clientManagement
      requisitionsView
      deploymentsView
      workersView
      variant="Operator"
      overview={OperatorOverview}
    />
  );
}
