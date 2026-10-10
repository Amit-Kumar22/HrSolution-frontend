import ResetPassword from "../reset-password";

export const metadata = {
  title: "Reset Password | Shakti Manpower",
  description: "Set a new password for your account.",
};

export default async function ResetPasswordTokenPage({ params }) {
  const { token } = await params;
  const value = Array.isArray(token) ? token[0] : String(token || "");

  return <ResetPassword token={value} />;
}