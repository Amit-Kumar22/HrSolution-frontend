import { Footer, Navbar } from "@/components/site-chrome";
import { SiteProvider } from "@/components/site-provider";
import CareersBrowser from "@/components/careers-browser";

export const metadata = {
  title: "Careers — Current job openings",
  description:
    "Browse verified current job openings in security, manufacturing, housekeeping, office staff and more. Apply online and join a trusted manpower employer.",
};

export default function CareersPage() {
  return (
    <SiteProvider>
      <Navbar />
      <main>
        <section className="section section-soft careers-hero">
          <div className="container">
            <span className="eyebrow">CAREERS</span>
            <h1>Current job openings</h1>
            <p>
              Verified employers, PF &amp; ESI benefits and salary on time — every month. Find a role that fits you and
              apply in minutes.
            </p>
          </div>
        </section>

        <section className="section section-white" id="openings">
          <div className="container">
            <CareersBrowser />
          </div>
        </section>
      </main>
      <Footer />
    </SiteProvider>
  );
}
