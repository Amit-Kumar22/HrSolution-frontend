"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { Chip, ErrorState, LoadingState } from "@/app/admin/admin-ui";
import { getMySite } from "@/lib/clientApi";
import { clientErrorMessage, siteAddress, siteLabel } from "@/lib/client-format";

function DetailRow({ label, value, full = false }) {
  return (
    <div className={`cmDetailRow${full ? " cmDetailFull" : ""}`}>
      <span className="cmDetailLabel">{label}</span>
      <span className="cmDetailValue">
        {value === null || value === undefined || value === "" ? "—" : value}
      </span>
    </div>
  );
}

function ActiveChip({ active }) {
  if (active === true) return <Chip tone="success">Active</Chip>;
  if (active === false) return <Chip tone="neutral">Inactive</Chip>;
  return <Chip tone="neutral">—</Chip>;
}

function siteErrorMessage(error) {
  if (error && error.status === 404) {
    return "This site does not exist, or you do not have permission to access it.";
  }
  if (error && error.status === 403) {
    return "You do not have permission to view this site.";
  }
  return clientErrorMessage(error, "The site details could not be loaded.");
}

export default function ClientSiteDetails({ siteId }) {
  const numericSiteId = Number(siteId);
  const validSiteId = Number.isInteger(numericSiteId) && numericSiteId > 0;
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(validSiteId);
  const [error, setError] = useState(validSiteId ? "" : "This site does not exist.");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!validSiteId) return undefined;
    let cancelled = false;
    getMySite(numericSiteId)
      .then((data) => {
        if (cancelled) return;
        setSite(data);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setSite(null);
        setError(siteErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [numericSiteId, reloadToken, validSiteId]);

  function reload() {
    setLoading(true);
    setError("");
    setReloadToken((token) => token + 1);
  }

  return (
    <section className="clPanel clientSiteDetails" aria-labelledby="client-site-details-title">
      <div className="clPanelHead">
        <div>
          <Link className="clientBackLink" href="/client/sites">
            <ArrowLeft size={14} /> Back to sites
          </Link>
          <h2 id="client-site-details-title">Site details</h2>
          <p>{validSiteId ? `Site #${numericSiteId}` : "Invalid site reference."}</p>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading site details…" />
      ) : error ? (
        <ErrorState message={error} onRetry={validSiteId ? reload : undefined} />
      ) : site ? (
        <>
          <div className="clSiteIdentity">
            <span className="clIconTile clTone-blue">
              <MapPin size={18} />
            </span>
            <div>
              <h3>{siteLabel(site)}</h3>
              <p>
                {site.siteCode ? <span className="cmCode">{site.siteCode}</span> : null}
                {site.clientName ? ` · ${site.clientName}` : ""}
              </p>
            </div>
            <ActiveChip active={site.active} />
          </div>

          <div className="clSiteContactStrip">
            <span><UserRound size={14} /> {site.siteInchargeName || "In-charge not set"}</span>
            <span><Phone size={14} /> {site.siteInchargePhone || "—"}</span>
            <span><Mail size={14} /> {site.siteInchargeEmail || "—"}</span>
          </div>

          <div className="cmDetailGrid">
            <DetailRow label="Site ID" value={site.id} />
            <DetailRow label="Site code" value={<span className="cmCode">{site.siteCode || "—"}</span>} />
            <DetailRow label="Site name" value={site.siteName} />
            <DetailRow label="Display label" value={site.displayLabel} />
            <DetailRow label="Client" value={site.clientName} />
            <DetailRow label="Client ID" value={site.clientId} />
            <DetailRow label="Address line 1" value={site.addressLine1} />
            <DetailRow label="Address line 2" value={site.addressLine2} />
            <DetailRow label="City" value={site.city} />
            <DetailRow label="State" value={site.state} />
            <DetailRow label="State code" value={site.stateCode} />
            <DetailRow label="PIN code" value={site.pincode} />
            <DetailRow label="In-charge name" value={site.siteInchargeName} />
            <DetailRow label="In-charge phone" value={site.siteInchargePhone} />
            <DetailRow label="In-charge email" value={site.siteInchargeEmail} />
            <DetailRow label="Active status" value={<ActiveChip active={site.active} />} />
            <DetailRow label="Full address" value={siteAddress(site)} full />
          </div>
        </>
      ) : null}
    </section>
  );
}
