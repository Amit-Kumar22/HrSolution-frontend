import { Geist } from "next/font/google";
import "./globals.css";
import "./login/login.css";
import "./admin/admin.css";
import "./auth/auth.css";
import AuthBootstrap from "@/components/auth-bootstrap";
import { getCompanyProfile } from "@/lib/publicApi";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const FALLBACK_TITLE = "Shree Manpower | Reliable Workforce Solutions";
const FALLBACK_DESCRIPTION =
  "Reliable, skilled and workforce-ready manpower solutions for businesses across India. Staffing, recruitment, payroll and compliance support.";

export async function generateMetadata() {
  "use cache";
  let profile = null;
  try {
    profile = await getCompanyProfile({ cache: "force-cache", signal: null });
  } catch {
    profile = null;
  }

  const name = profile?.tradeName || profile?.legalName || null;
  const description = (typeof profile?.tagline === "string" && profile.tagline.trim()) || FALLBACK_DESCRIPTION;

  return {
    title: name ? `${name} | Reliable Workforce Solutions` : FALLBACK_TITLE,
    description,
  };
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthBootstrap />
        {children}
      </body>
    </html>
  );
}
