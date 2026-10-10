import VerifyEmail from "./verify-email";

export const metadata = {
  title: "Verify Email | Shakti Manpower",
  description: "Confirm your email address to activate your account.",
};

export default async function VerifyEmailPage({ searchParams }) {
  const query = await searchParams;
  const queryToken = query && query.token ? query.token : "";
  const token = Array.isArray(queryToken) ? queryToken[0] : String(queryToken || "");

  return <VerifyEmail token={token} />;
}