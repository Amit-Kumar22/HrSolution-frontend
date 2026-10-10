"use client";

import { useEffect, useState } from "react";
import AccountDashboard from "@/components/account-dashboard";
import { getMyClient } from "@/lib/clientApi";

export default function ClientDashboardPage() {
  const [company, setCompany] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getMyClient();
        if (!cancelled) setCompany(data);
      } catch (caught) {
        if (cancelled) return;
        const msg = caught instanceof Error && caught.message ? caught.message : "Your company details could not be loaded.";
        setError(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <AccountDashboard
        role="CLIENT"
        heading="Client portal"
        subtitle="Your company workspace for requisitions, deployments and billing."
        roleTitle="Your client workspace"
        highlights={[
          "Raise requisitions and review shortlists once approved.",
          "Track deployments and attendance for your sites.",
          "Download monthly invoices and compliance records.",
        ]}
        statusGuidance={{
          PENDING_APPROVAL:
            "Your company registration is awaiting administrator approval. Client features unlock automatically once an administrator approves your account.",
          DISABLED: "This client account has been disabled. Please contact your Shakti Manpower account manager.",
          REJECTED: "This client registration was not approved. Please contact support for more details.",
        }}
      />
      {company && (
        <section style={{ maxWidth: 1100, margin: "0 auto 40px", padding: "0 24px" }}>
          <div className="accountCard" style={{ marginTop: 20 }}>
            <h2>Your company</h2>
            <dl style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              <div className="accountField">
                <dt>Legal name</dt>
                <dd>{company.legalName || "—"}</dd>
              </div>
              <div className="accountField">
                <dt>Client code</dt>
                <dd>{company.clientCode || "—"}</dd>
              </div>
              <div className="accountField">
                <dt>Status</dt>
                <dd>{company.status || "—"}</dd>
              </div>
              <div className="accountField">
                <dt>GSTIN</dt>
                <dd>{company.gstin || "—"}</dd>
              </div>
              <div className="accountField">
                <dt>Industry</dt>
                <dd>{company.industryName || "—"}</dd>
              </div>
              <div className="accountField">
                <dt>Active sites</dt>
                <dd>{company.activeSiteCount ?? 0}</dd>
              </div>
              <div className="accountField">
                <dt>Active contracts</dt>
                <dd>{company.activeContractCount ?? 0}</dd>
              </div>
            </dl>
          </div>
        </section>
      )}
      {error && (
        <div style={{ maxWidth: 1100, margin: "0 auto 40px", padding: "0 24px" }}>
          <div className="authAlert authAlert--error" role="alert">{error}</div>
        </div>
      )}
    </>
  );
}