import ResetPassword from "./reset-password";

export const metadata = {
  title: "Reset Password | Shakti Manpower",
  description: "Set a new password for your account.",
};

export default async function ResetPasswordPage({ searchParams }) {
  const query = await searchParams;
  const queryToken = query && query.token ? query.token : "";
  const token = Array.isArray(queryToken) ? queryToken[0] : String(queryToken || "");

  return <ResetPassword token={token} />;
}