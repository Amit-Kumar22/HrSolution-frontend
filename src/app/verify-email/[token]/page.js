import VerifyEmail from "../verify-email";

export const metadata = {
  title: "Verify Email | Shakti Manpower",
  description: "Confirm your email address to activate your account.",
};

export default async function VerifyEmailTokenPage({ params }) {
  const { token } = await params;
  const value = Array.isArray(token) ? token[0] : String(token || "");

  return <VerifyEmail token={value} />;
}