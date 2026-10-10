import AccountDashboard from "@/components/account-dashboard";

export const metadata = {
  title: "Candidate Portal | Shakti Manpower",
  description: "Track your applications and profile as a Shakti Manpower candidate.",
};

export default function CandidateDashboardPage() {
  return (
    <AccountDashboard
      role="CANDIDATE"
      heading="Candidate portal"
      subtitle="Your job-seeker workspace for applications and profile updates."
      roleTitle="Your job-seeker workspace"
      highlights={[
        "Verify your email address to activate your account.",
        "Complete your profile so employers can find you.",
        "Apply to verified openings and track their status.",
      ]}
      statusGuidance={{
        PENDING_VERIFICATION:
          "Your email address is not verified yet. Open the verification link we emailed you, or request a new one below.",
        DISABLED: "This account has been disabled. Please contact Shakti Manpower support.",
        REJECTED: "This account was not approved. Please contact support for more details.",
      }}
    />
  );
}