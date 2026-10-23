"use client";

import { Building2, FileSignature, MapPin, ReceiptText } from "lucide-react";
import { Chip, EmptyState, ErrorState, LoadingState, formatDate } from "@/app/admin/admin-ui";
import {
  companyBillingAddress,
  companyName,
  companyStatusMeta,
  gstTreatmentLabel,
} from "@/lib/client-format";

function Detail({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value === null || value === undefined || value === "" ? "—" : value}</dd>
    </div>
  );
}

export default function ClientCompanyProfile({ company, loading = false, error = "", onRetry }) {
  if (loading) {
    return (
      <section className="clPanel">
        <LoadingState label="Loading company profile…" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="clPanel">
        <ErrorState message={error} onRetry={onRetry} />
      </section>
    );
  }

  if (!company) {
    return (
      <section className="clPanel">
        <EmptyState
          icon={Building2}
          title="No company linked"
          message="Your account is not associated with a client company. Contact your Shakti Manpower account manager for help."
        />
      </section>
    );
  }

  const status = companyStatusMeta(company.status);

  return (
    <section className="clPanel clientCompanyProfile" aria-labelledby="client-company-profile-title">
      <div className="clCompanyIdentity">
        <span className="clIconTile clTone-blue">
          <Building2 size={18} />
        </span>
        <div>
          <h2 id="client-company-profile-title">{companyName(company)}</h2>
          <p>
            {company.clientCode || "—"}
            {company.industryName ? ` · ${company.industryName}` : ""}
          </p>
        </div>
        <Chip tone={status.tone}>{status.label}</Chip>
      </div>

      <div className="clCompanyStats">
        <div>
          <MapPin size={14} />
          <span>Active sites</span>
          <strong>{company.activeSiteCount ?? "—"}</strong>
        </div>
        <div>
          <FileSignature size={14} />
          <span>Active contracts</span>
          <strong>{company.activeContractCount ?? "—"}</strong>
        </div>
        <div>
          <ReceiptText size={14} />
          <span>Payment terms</span>
          <strong>{company.paymentTermsDays != null ? `${company.paymentTermsDays} days` : "—"}</strong>
        </div>
      </div>

      <div className="clCompanySections">
        <section aria-labelledby="company-identity-title">
          <h3 id="company-identity-title">Company identity</h3>
          <dl className="clDetails">
            <Detail label="Display name" value={company.displayName} />
            <Detail label="Legal name" value={company.legalName} />
            <Detail label="Trade name" value={company.tradeName} />
            <Detail label="Client code" value={company.clientCode} />
            <Detail label="Industry" value={company.industryName} />
            <Detail label="Industry ID" value={company.industryId} />
            <Detail label="Onboarded on" value={company.onboardedOn ? formatDate(company.onboardedOn) : "—"} />
            <Detail label="Company status" value={<Chip tone={status.tone}>{status.label}</Chip>} />
          </dl>
        </section>

        <section aria-labelledby="company-statutory-title">
          <h3 id="company-statutory-title">Statutory details</h3>
          <dl className="clDetails">
            <Detail label="GSTIN" value={company.gstin} />
            <Detail label="PAN" value={company.pan} />
            <Detail label="CIN" value={company.cin} />
            <Detail label="GST treatment" value={gstTreatmentLabel(company.gstTreatment)} />
          </dl>
        </section>

        <section className="clCompanySectionFull" aria-labelledby="company-billing-title">
          <h3 id="company-billing-title">Billing address</h3>
          <dl className="clDetails">
            <Detail label="Address line 1" value={company.billingAddressLine1} />
            <Detail label="Address line 2" value={company.billingAddressLine2} />
            <Detail label="City" value={company.billingCity} />
            <Detail label="State" value={company.billingState} />
            <Detail label="State code" value={company.billingStateCode} />
            <Detail label="PIN code" value={company.billingPincode} />
            <Detail label="Country" value={company.billingCountry} />
            <Detail label="Full address" value={companyBillingAddress(company)} />
          </dl>
        </section>

        <section aria-labelledby="company-commercial-title">
          <h3 id="company-commercial-title">Commercial details</h3>
          <dl className="clDetails">
            <Detail label="Payment terms" value={company.paymentTermsDays != null ? `${company.paymentTermsDays} days` : "—"} />
            <Detail label="Active sites" value={company.activeSiteCount} />
            <Detail label="Active contracts" value={company.activeContractCount} />
            <Detail label="Company ID" value={company.id} />
          </dl>
        </section>

        {company.notes && (
          <section className="clCompanySectionFull" aria-labelledby="company-notes-title">
            <h3 id="company-notes-title">Notes</h3>
            <p className="clCompanyNotes">{company.notes}</p>
          </section>
        )}
      </div>
    </section>
  );
}
