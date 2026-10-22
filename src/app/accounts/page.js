import RoleDashboard from "@/components/role-dashboard";
import AccountsOverview from "@/components/accounts-overview";

export const metadata = {
  title: "Accounts Dashboard | Shakti Manpower",
  description: "Accounts workspace for payroll, invoices and financial records.",
};

export default function AccountsPage() {
  return (
    <RoleDashboard
      allowedRoles={["ACCOUNTS", "ACCOUNTANT"]}
      dashboardName="Accounts Dashboard"
      description="Your finance workspace. You only see the modules and actions granted to your role."
      clientView
      variant="Accounts"
      overview={AccountsOverview}
    />
  );
}
