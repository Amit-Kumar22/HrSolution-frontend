"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, FileSignature, IndianRupee, MapPin, Pencil, Trash2, Users } from "lucide-react";
import { deleteClient, getClientDetail } from "@/lib/adminApi";
import { formatDate } from "./admin-ui";
import {
  Chip,
  ConfirmDialog,
  ErrorState,
  LoadingState,
  Modal,
} from "./admin-ui";
import { StatusChip } from "./client-modals";
import ClientSitesTab from "./client-sites-tab";
import ClientUsersTab from "./client-users-tab";
import RateCardsTab from "./rate-cards-panel";
import ContractsPanel from "./contracts-panel";

const TABS = [
  { key: "overview", label: "Overview", icon: Building2 },
  { key: "users", label: "Client users", icon: Users },
  { key: "sites", label: "Sites", icon: MapPin },
  { key: "rate-cards", label: "Rate cards", icon: IndianRupee },
  { key: "contracts", label: "Contracts", icon: FileSignature },
];

function DetailRow({ label, value, wide = false }) {
  return (
    <div className={`cmDetailRow${wide ? " cmDetailFull" : ""}`}>
      <span className="cmDetailLabel">{label}</span>
      <span className="cmDetailValue">{value === null || value === undefined || value === "" ? "—" : value}</span>
    </div>
  );
}

function OverviewTab({ detail }) {
  const client = detail.client;
  const rows = [
    <DetailRow key="code" label="Client code" value={<span className="cmCode">{client.clientCode || "—"}</span>} />,
    <DetailRow key="legal" label="Legal name" value={client.legalName} />,
    <DetailRow key="trade" label="Trade name" value={client.tradeName} />,
    <DetailRow key="display" label="Display name" value={client.displayName} />,
    <DetailRow key="gstin" label="GSTIN" value={client.gstin} />,
    <DetailRow key="pan" label="PAN" value={client.pan} />,
    <DetailRow key="cin" label="CIN" value={client.cin} />,
    <DetailRow key="addr" label="Billing address" value={[client.billingAddressLine1, client.billingAddressLine2].filter(Boolean).join(", ")} wide />,
    <DetailRow key="city" label="City" value={client.billingCity} />,
    <DetailRow key="state" label="State" value={client.billingState} />,
    <DetailRow key="statecode" label="State code" value={<Chip tone="info">{client.billingStateCode || "—"}</Chip>} />,
    <DetailRow key="pin" label="Pincode" value={client.billingPincode} />,
    <DetailRow key="country" label="Country" value={client.billingCountry} />,
    <DetailRow key="industry" label="Industry" value={client.industryName} />,
    <DetailRow key="gst" label="GST treatment" value={client.gstTreatment} />,
    <DetailRow key="terms" label="Payment terms" value={client.paymentTermsDays != null ? `${client.paymentTermsDays} days` : null} />,
    <DetailRow key="onboard" label="Onboarding date" value={formatDate(client.onboardedOn)} />,
    <DetailRow key="status" label="Client status" value={<StatusChip status={client.status} />} />,
    <DetailRow key="sites" label="Active sites" value={client.activeSiteCount} />,
    <DetailRow key="contracts" label="Active contracts" value={client.activeContractCount} />,
  ];

  return (
    <>
      <div className="cmDetailGrid" style={{ marginTop: 16 }}>{rows}</div>
      <div className="cmDetailSection">
        <h3>Notes</h3>
        <p className="cmNotes">{client.notes || "No notes recorded for this client."}</p>
      </div>
    </>
  );
}

export default function ClientDetailDialog({ client, initialTab = "overview", onClose, onEdit, onStatusChange, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(initialTab);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await getClientDetail(client.id);
      setDetail(data);
      setError("");
    } catch (err) {
      setError(err && typeof err.message === "string" ? err.message : "The client details could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [client.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load(cancelled);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteClient(client.id);
      if (typeof onChanged === "function") onChanged("Client deleted.");
      onClose();
    } catch (err) {
      setDeleteError(err && typeof err.message === "string" ? err.message : "The client could not be deleted.");
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  function handleTabChange(key) {
    setTab(key);
    if (key === "overview" && !loading && !error && !detail) load();
  }

  return (
    <Modal
      wide
      title={client.legalName || "Client details"}
      description={`${client.clientCode ? `Client code ${client.clientCode} · ` : ""}${client.status || ""}`}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="cmDangerButton cmBtn" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={15} /> Delete
          </button>
          <button type="button" className="secondaryButton cmBtn" onClick={onStatusChange}>
            Change status
          </button>
          <button type="button" className="secondaryButton cmBtn" onClick={onEdit}>
            <Pencil size={15} /> Edit
          </button>
          <button type="button" className="primaryButton cmBtn" onClick={onClose}>Close</button>
        </>
      )}
    >
      <div className="cmStatusRow" style={{ marginBottom: 14 }}>
        <StatusChip status={client.status} />
        {client.gstin && <Chip tone="info">{client.gstin}</Chip>}
        {client.activeSiteCount > 0 && <Chip tone="success">{client.activeSiteCount} active site{client.activeSiteCount === 1 ? "" : "s"}</Chip>}
        {client.activeContractCount > 0 && <Chip tone="accent">{client.activeContractCount} active contract{client.activeContractCount === 1 ? "" : "s"}</Chip>}
      </div>

      <div className="cmToolbar" style={{ gap: 8, marginBottom: 12 }}>
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              className={`secondaryButton cmBtn${tab === item.key ? " primaryButton" : ""}`}
              onClick={() => handleTabChange(item.key)}
            >
              <Icon size={15} /> {item.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && (loading ? (
        <LoadingState label="Loading client details…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : detail ? (
        <OverviewTab detail={detail} />
      ) : null)}

      {tab === "users" && (
        <ClientUsersTab
          client={client}
          onChanged={(message) => { if (typeof onChanged === "function") onChanged(message); load(); }}
        />
      )}

      {tab === "sites" && (
        <ClientSitesTab
          client={client}
          onChanged={(message) => { if (typeof onChanged === "function") onChanged(message); load(); }}
        />
      )}

      {tab === "rate-cards" && (
        <RateCardsTab
          client={client}
          onChanged={(message) => { if (typeof onChanged === "function") onChanged(message); load(); }}
        />
      )}

      {tab === "contracts" && (
        <ContractsPanel
          client={client}
          embedded
          onChanged={(message) => { if (typeof onChanged === "function") onChanged(message); load(); }}
        />
      )}

      {deleteOpen && (
        <ConfirmDialog
          title="Delete client"
          message={`Delete “${client.legalName}” (${client.clientCode || "no code"})? This is a soft delete — associated records are preserved for history. A client cannot be deleted while an active contract exists.`}
          confirmLabel="Delete client"
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => { if (!deleting) setDeleteOpen(false); }}
        />
      )}
      {deleteError && <p className="actionError" role="alert">{deleteError}</p>}
    </Modal>
  );
}
