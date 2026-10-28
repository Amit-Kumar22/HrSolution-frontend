import RoleDashboard from "@/components/role-dashboard";
import HrOverview from "@/components/hr-overview";
import "./hr.css";

export const metadata = {
  title: "HR Dashboard | Shakti Manpower",
  description: "HR workspace for recruitment, workforce and documentation.",
};

export default function HrPage() {
  return (
    <RoleDashboard
      allowedRoles={["HR", "HR_RECRUITER", "HR_MANAGER"]}
      dashboardName="HR Dashboard"
      description="Your HR workspace. You only see the modules and actions granted to your role."
      clientView
      candidatesView
      jobsView
      interviewsView
      requisitionsView
      workersView
      leaveView
      holidayView
      payrollView
      variant="Hr"
      overview={HrOverview}
    />
  );
}
