"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, MapPin, RefreshCw } from "lucide-react";
import { Chip, EmptyState, ErrorState, LoadingState } from "@/app/admin/admin-ui";
import { listMySites } from "@/lib/clientApi";
import { clientErrorMessage, companyName, siteAddress, siteLabel } from "@/lib/client-format";

function siteError(error) {
  if (error && error.status === 403) {
    return "You do not have permission to view sites for this company.";
  }
  return clientErrorMessage(error, "Your sites could not be loaded.");
}

function ActiveChip({ active }) {
  if (active === true) return <Chip tone="success">Active</Chip>;
  if (active === false) return <Chip tone="neutral">Inactive</Chip>;
  return <Chip tone="neutral">—</Chip>;
}

export default function ClientSites({ company, companyLoading = false, companyError = "", onCompanyRetry }) {
  const clientId = company && company.id != null ? company.id : null;
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    listMySites(clientId)
      .then((data) => {
        if (cancelled) return;
        setSites(data);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setSites([]);
        setError(siteError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, reloadToken]);

  const orderedSites = useMemo(() => {
    const active = sites.filter((site) => site.active === true);
    const other = sites.filter((site) => site.active !== true);
    return [...active, ...other];
  }, [sites]);

  function reload() {
    setLoading(true);
    setError("");
    setReloadToken((token) => token + 1);
  }

  if (companyLoading) {
    return (
      <section className="clPanel">
        <LoadingState label="Loading your company…" />
      </section>
    );
  }

  if (companyError) {
    return (
      <section className="clPanel">
        <ErrorState message={companyError} onRetry={onCompanyRetry} />
      </section>
    );
  }

  if (!clientId) {
    return (
      <section className="clPanel">
        <EmptyState
          icon={MapPin}
          title="No company linked"
          message="Your account is not associated with a client company, so sites cannot be loaded."
        />
      </section>
    );
  }

  return (
    <section className="clPanel clientSitesPanel" aria-labelledby="client-sites-title">
      <div className="clPanelHead">
        <div>
          <h2 id="client-sites-title">Sites</h2>
          <p>Locations registered for {companyName(company)}.</p>
        </div>
        <div className="clientPanelActions">
          <span className="clCount">{sites.length} site{sites.length === 1 ? "" : "s"}</span>
          <button type="button" className="secondaryButton cmBtn" onClick={reload} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading your sites…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : orderedSites.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No sites yet"
          message="When Shakti Manpower registers a site for your company, it will appear here."
        />
      ) : (
        <div className="cmTableWrap">
          <table className="cmTable clientSitesTable">
            <thead>
              <tr>
                <th>Site</th>
                <th>Client</th>
                <th>Address</th>
                <th>City / State</th>
                <th>In-charge</th>
                <th>Contact</th>
                <th className="cmColCenter">Status</th>
                <th className="cmColActions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orderedSites.map((site) => (
                <tr key={site.id}>
                  <td>
                    <div className="cmEntity">
                      <span className="cmIconTile"><MapPin size={16} /></span>
                      <span>
                        <strong>{siteLabel(site)}</strong>
                        {site.siteName && site.siteName !== siteLabel(site) ? (
                          <small className="cmMuted cmBlock">{site.siteName}</small>
                        ) : null}
                        <small className="cmMuted cmBlock">
                          <span className="cmCode">{site.siteCode || "—"}</span>
                          {site.id != null ? ` · Site #${site.id}` : ""}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td className="cmMuted">
                    <span className="cmBlock">{site.clientName || companyName(company)}</span>
                    <small>{site.clientId != null ? `Client #${site.clientId}` : "—"}</small>
                  </td>
                  <td className="cmMuted cmCellWrap">{siteAddress(site)}</td>
                  <td className="cmMuted">
                    <span className="cmBlock">{[site.city, site.state].filter(Boolean).join(", ") || "—"}</span>
                    <small>{site.stateCode ? `State code ${site.stateCode}` : "State code —"}</small>
                  </td>
                  <td className="cmMuted">
                    <span className="cmBlock">{site.siteInchargeName || "—"}</span>
                    <small>{site.siteInchargePhone || "—"}</small>
                  </td>
                  <td className="cmMuted cmCellWrap">{site.siteInchargeEmail || "—"}</td>
                  <td className="cmColCenter"><ActiveChip active={site.active} /></td>
                  <td className="cmColActions">
                    <div className="cmRowActions">
                      <Link
                        className="secondaryButton cmBtn clientSiteViewButton"
                        href={`/client/sites/${encodeURIComponent(site.id)}`}
                      >
                        <Eye size={14} /> View details
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
