import AccountDashboard from "@/components/account-dashboard";

export const metadata = {
  title: "My Account | Shakti Manpower",
  description: "Your Shakti Manpower account overview.",
};

export default function AccountPage() {
  return (
    <AccountDashboard
      role="ACCOUNT"
      heading="My account"
      subtitle="Your profile, roles and permissions across the Shakti Manpower portal."
      roleTitle="Account overview"
      highlights={[
        "Review your profile details and account status.",
        "Check the roles and permissions assigned to you.",
        "Manage the devices signed in to your account.",
      ]}
      statusGuidance={{
        PENDING_VERIFICATION: "Your email address is not verified yet. Open the verification link we emailed you, or request a new one from the sign-in page.",
        PENDING_APPROVAL: "Your account is awaiting approval. Some features unlock once an administrator approves it.",
        DISABLED: "This account has been disabled. Please contact Shakti Manpower support.",
        REJECTED: "This account was not approved. Please contact support for more details.",
      }}
    />
  );
}