"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CreditCard, Landmark, Loader2, Plus, Power, Trash2 } from "lucide-react";
import {
  Chip,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FlashBanner,
  LoadingState,
  Modal,
  SectionHead,
  formatDate,
  useFlash,
} from "../admin/admin-ui";
import { BankAccountModal } from "../admin/worker-modals";
import {
  deleteBankAccount,
  getWorker,
  listBankAccounts,
  setBankAccountActive,
  setPrimaryBankAccount,
} from "../../lib/workerApi";

function maskAccount(value) {
  if (!value) return "—";
  const digits = String(value).replace(/\D/g, "");
  if (digits.length <= 4) return digits;
  return `•••• ${digits.slice(-4)}`;
}

export default function WorkerBankAccountsPanel({ session }) {
  const user = (session && session.user) || {};
  const workerId = user && user.id != null ? String(user.id) : null;
  const [worker, setWorker] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [accountsError, setAccountsError] = useState("");
  const [accountsKey, setAccountsKey] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [primaryTarget, setPrimaryTarget] = useState(null);
  const [flash, showFlash] = useFlash();
  const requestKey = `${workerId ?? ""}:${refreshKey}`;

  const loading = useMemo(
    () => Boolean(workerId) && accountsKey !== requestKey,
    [workerId, requestKey, accountsKey],
  );

  const reload = useCallback(() => {
    setAccountsError("");
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!workerId) return undefined;
    const current = requestKey;
    getWorker(workerId)
      .then((payload) => {
        setWorker(payload);
      })
      .catch(() => {
        setWorker(null);
      });
    listBankAccounts(workerId)
      .then((payload) => {
        setAccounts(Array.isArray(payload) ? payload : []);
        setAccountsError("");
        setAccountsKey(current);
      })
      .catch((error) => {
        setAccountsError(error instanceof Error ? error.message : "Bank accounts could not be loaded.");
        setAccountsKey(current);
      });
  }, [workerId, requestKey]);

  async function handleSetPrimary(account) {
    if (busyAction || account.primaryAccount) return;
    setPrimaryTarget(account);
  }

  async function confirmSetPrimary() {
    if (!primaryTarget || busyAction) return;
    setBusyAction("bank-primary");
    try {
      await setPrimaryBankAccount(primaryTarget.id);
      setPrimaryTarget(null);
      reload();
      showFlash("success", "The primary account was changed.");
    } catch (error) {
      setPrimaryTarget(null);
      showFlash("error", error instanceof Error ? error.message : "The primary account could not be changed.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleToggle(account) {
    if (busyAction || account.primaryAccount) return;
    setToggleTarget(account);
  }

  async function confirmToggle() {
    if (!toggleTarget || busyAction) return;
    setBusyAction("bank-toggle");
    try {
      await setBankAccountActive(toggleTarget.id, !toggleTarget.active);
      setToggleTarget(null);
      reload();
      showFlash(
        "success",
        toggleTarget.active ? "The account was deactivated." : "The account was activated.",
      );
    } catch (error) {
      setToggleTarget(null);
      showFlash("error", error instanceof Error ? error.message : "The account status could not be changed.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleDelete(account) {
    if (busyAction) return;
    setDeleteTarget(account);
  }

  async function confirmDelete() {
    if (!deleteTarget || busyAction) return;
    setBusyAction("bank-delete");
    try {
      await deleteBankAccount(deleteTarget.id);
      setDeleteTarget(null);
      reload();
      showFlash("success", "The bank account was removed.");
    } catch (error) {
      setDeleteTarget(null);
      showFlash("error", error instanceof Error ? error.message : "The bank account could not be removed.");
    } finally {
      setBusyAction("");
    }
  }

  function handleAddSaved() {
    setAddOpen(false);
    reload();
    showFlash("success", "Bank account added.");
  }

  if (loading) return <LoadingState label="Loading your bank accounts…" />;
  if (!workerId) return <ErrorState message="No worker account is linked to this session." />;
  if (accountsError) return <ErrorState message={accountsError} onRetry={reload} />;

  const workerForModal = worker || {
    id: workerId,
    fullName: user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || "Worker",
  };
  const hasAccounts = accounts.length > 0;

  return (
    <div className="wbWorkerBankAccountsPanel">
      <SectionHead
        title="My bank accounts"
        description="Add the bank account your wages should be paid into. Account numbers are masked and encrypted at rest."
        action={(
          <button type="button" className="primaryButton cmBtn" onClick={() => setAddOpen(true)} disabled={busyAction}>
            <Plus size={15} /> Add bank account
          </button>
        )}
      />

      <FlashBanner flash={flash} />

      {!accounts.length ? (
        <EmptyState
          icon={CreditCard}
          title="No bank account"
          message="Add the bank account wages should be paid into. The first account you add becomes the primary account."
        />
      ) : (
        <div className="wbAccountList">
          {accounts.map((account) => (
            <article className="wbAccountCard" key={account.id}>
              <div className="wbAccountMain">
                <span className="wbAccountIcon"><Landmark size={17} /></span>
                <div>
                  <strong>{account.displayLabel || maskAccount(account.accountNumberMasked || account.accountNumber)}</strong>
                  <small>
                    {account.bankName}{account.branch ? ` · ${account.branch}` : ""}
                  </small>
                  <small className="wbAccountMetaLine">
                    {account.ifsc ? `IFSC ${account.ifsc}` : ""}
                    {account.accountHolderName ? ` · ${account.accountHolderName}` : ""}
                  </small>
                </div>
              </div>
              <div className="wbAccountMeta">
                {account.primaryAccount && <Chip tone="success">Primary — wages paid here</Chip>}
                {!account.primaryAccount && <Chip tone="neutral">Secondary</Chip>}
                <Chip tone={account.active ? "info" : "warn"}>
                  {account.active ? "Active" : "Inactive"}
                </Chip>
              </div>
              <div className="wbRowActions">
                {!account.primaryAccount && account.active && (
                  <button
                    type="button"
                    className="wbIconButton"
                    title="Set as primary account"
                    aria-label="Set as primary account"
                    onClick={() => handleSetPrimary(account)}
                    disabled={busyAction === "bank-primary" || busyId === account.id}
                  >
                    {busyId === account.id ? <Loader2 size={14} className="spin" /> : <CreditCard size={14} />}
                  </button>
                )}
                <button
                  type="button"
                  className="wbIconButton"
                  title={account.active ? "Deactivate account" : "Activate account"}
                  aria-label={account.active ? "Deactivate account" : "Activate account"}
                  onClick={() => (account.primaryAccount ? null : handleToggle(account))}
                  disabled={
                    account.primaryAccount ||
                    busyAction === "bank-toggle" ||
                    busyId === account.id
                  }
                >
                  {busyId === account.id ? <Loader2 size={14} className="spin" /> : (
                    account.active ? <Power size={14} /> : <CreditCard size={14} />
                  )}
                </button>
                {!account.primaryAccount && accounts.length > 1 && (
                  <button
                    type="button"
                    className="wbIconButton wbIconDanger"
                    title="Remove account"
                    aria-label="Remove account"
                    onClick={() => handleDelete(account)}
                    disabled={busyAction === "bank-delete" || busyId === account.id}
                  >
                    {busyId === account.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {addOpen && worker && (
        <BankAccountModal
          worker={workerForModal}
          hasAccounts={hasAccounts}
          onClose={() => setAddOpen(false)}
          onSaved={handleAddSaved}
        />
      )}

      {primaryTarget && (
        <ConfirmDialog
          title="Set as primary account"
          message="This account will be used for wage payments. The previous primary account will be demoted automatically."
          confirmLabel="Set as primary"
          confirmVariant="primary"
          busy={busyAction === "bank-primary"}
          onConfirm={confirmSetPrimary}
          onCancel={() => setPrimaryTarget(null)}
        />
      )}
      {toggleTarget && (
        <ConfirmDialog
          title={toggleTarget.active ? "Deactivate account" : "Activate account"}
          message={
            toggleTarget.active
              ? "The account will be deactivated and will not receive wage payments. The primary account cannot be deactivated."
              : "The account will be activated again and can receive wage payments."
          }
          confirmLabel={toggleTarget.active ? "Deactivate" : "Activate"}
          confirmVariant={toggleTarget.active ? "danger" : "primary"}
          busy={busyAction === "bank-toggle"}
          onConfirm={confirmToggle}
          onCancel={() => setToggleTarget(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Remove bank account"
          message="The account will be soft deleted. A primary account cannot be removed while another account exists."
          confirmLabel="Remove account"
          confirmVariant="danger"
          busy={busyAction === "bank-delete"}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
