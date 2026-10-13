import RoleDashboard from "@/components/role-dashboard";

export const metadata = {
  title: "Operator Dashboard | Shakti Manpower",
  description: "Operator workspace for authorised day-to-day operations.",
};

export default function OperatorPage() {
  return (
    <RoleDashboard
      allowedRoles={["OPERATOR", "OPERATIONS", "SECURITY_GUARD"]}
      dashboardName="Operator Dashboard"
      description="Your operations workspace. You only see the modules and actions granted to your role."
    />
  );
}
