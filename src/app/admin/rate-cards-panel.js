"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  IndianRupee,
  ListFilter,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SearchCheck,
  Trash2,
} from "lucide-react";
import {
  createClientRateCard,
  deleteRateCard,
  getRateCard,
  listClientRateCards,
  listClientSites,
  listManpowerCategories,
  resolveClientRateCard,
  updateRateCard,
} from "@/lib/adminApi";
import { skillLevelLabel, SKILL_LEVEL_TONES } from "@/lib/manpower-forms";
import {
  EMPTY_RATE_CARD_FORM,
  formatMargin,
  formatMoney,
  isBillingBelowWage,
  isFutureRate,
  rateCardFormToPayload,
  rateCardStatus,
  rateCardToForm,
  RATE_STATUS_LABELS,
  RATE_STATUS_TONES,
  todayDateString,
  validateRateCardForm,
} from "@/lib/rate-card-forms";
import {
  Chip,
  ConfirmDialog,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  FlashBanner,
  LoadingState,
  Modal,
  Notice,
  formatDate,
  useFlash,
} from "./admin-ui";

function errorMessage(error, fallback) {
  if (error && typeof error === "object" && typeof error.message === "string" && error.message.trim()) return error.message;
  return fallback;
}

function payloadErrors(error) {
  if (error && typeof error === "object" && error.fields && typeof error.fields === "object") return error.fields;
  return {};
}

function RateStatusChip({ rate }) {
  const status = rateCardStatus(rate);
  return <Chip tone={RATE_STATUS_TONES[status] || "neutral"}>{RATE_STATUS_LABELS[status] || status}</Chip>;
}

function DetailRow({ label, value, wide = false }) {
  return (
    <div className={`cmDetailRow${wide ? " cmDetailFull" : ""}`}>
      <span className="cmDetailLabel">{label}</span>
      <span className="cmDetailValue">{value === null || value === undefined || value === "" ? "—" : value}</span>
    </div>
  );
}

function RateCardFormDialog({ client, categories, sites, rate, onClose, onDone }) {
  const [form, setForm] = useState(() => (rate ? rateCardToForm(rate) : { ...EMPTY_RATE_CARD_FORM, effectiveFrom: todayDateString() }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const belowWage = isBillingBelowWage(form);
  const lossAmount = belowWage ? Number(form.monthlyWage) - Number(form.billingRate) : 0;

  function update(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    const found = validateRateCardForm(form);
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) {
      setFormError("Please correct the highlighted fields and try again.");
      return;
    }
    setSaving(true);
    try {
      const payload = rateCardFormToPayload(form);
      if (rate) {
        await updateRateCard(rate.id, payload);
        onDone("Rate card updated.");
      } else {
        await createClientRateCard(client.id, payload);
        onDone("Rate card created. Any previous open rate was closed off.");
      }
    } catch (error) {
      setErrors(payloadErrors(error));
      setFormError(errorMessage(error, rate ? "The rate card could not be updated." : "The rate card could not be created."));
      setSaving(false);
    }
  }

  return (
    <Modal
      wide
      title={rate ? "Edit rate card" : "Add rate card"}
      description={
        rate
          ? `Correcting a future rate for ${client.legalName || "this client"}.`
          : `A new rate supersedes the current rate for the same category and site — history is preserved.`
      }
      onClose={() => { if (!saving) onClose(); }}
      footer={(
        <>
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="rate-card-form" className="primaryButton cmBtn" disabled={saving}>
            {saving ? "Saving…" : rate ? "Save changes" : "Create rate card"}
          </button>
        </>
      )}
    >
      <form id="rate-card-form" className="cmForm" onSubmit={handleSubmit} noValidate>
        {formError && <p className="actionError" role="alert">{formError}</p>}
        <div className="cmFormGrid">
          <div className="cmFormRow">
            <Field label="Manpower category" htmlFor="rc-category" required error={errors.categoryId} hint="The skill level of the category selects the minimum wage band.">
              <select id="rc-category" value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)}>
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}{category.active === false ? " (inactive)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Site" htmlFor="rc-site" error={errors.siteId} hint="Leave as client-wide to cover every site; set a site to override it.">
              <select id="rc-site" value={form.siteId} onChange={(event) => update("siteId", event.target.value)}>
                <option value="">All sites (client-wide)</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.displayLabel || `${site.siteCode} — ${site.siteName}`}{site.active === false ? " (inactive)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="Monthly wage (₹)" htmlFor="rc-wage" required error={errors.monthlyWage} hint="Wage payable to the worker.">
              <input id="rc-wage" type="number" min="0" step="0.01" value={form.monthlyWage} placeholder="18000" onChange={(event) => update("monthlyWage", event.target.value)} />
            </Field>
            <Field label="Billing rate (₹)" htmlFor="rc-billing" required error={errors.billingRate} hint="Monthly amount billed per worker.">
              <input id="rc-billing" type="number" min="0" step="0.01" value={form.billingRate} placeholder="22500" onChange={(event) => update("billingRate", event.target.value)} />
            </Field>
          </div>
          {belowWage && (
            <Notice tone="warn">
              Billing rate is below the monthly wage — this rate means a loss of {formatMoney(lossAmount)} per worker each month.
              The backend allows this commercial decision, so you can still save it.
            </Notice>
          )}
          <div className="cmFormRow">
            <Field label="Overtime rate per hour (₹)" htmlFor="rc-ot" error={errors.otRatePerHour} hint="Optional.">
              <input id="rc-ot" type="number" min="0" step="0.01" value={form.otRatePerHour} placeholder="120" onChange={(event) => update("otRatePerHour", event.target.value)} />
            </Field>
            <Field label="Shift hours" htmlFor="rc-shift" required error={errors.shiftHours} hint="Between 1 and 24.">
              <input id="rc-shift" type="number" min="1" max="24" step="1" value={form.shiftHours} onChange={(event) => update("shiftHours", event.target.value)} />
            </Field>
          </div>
          <Field label="Effective from" htmlFor="rc-from" required error={errors.effectiveFrom} hint="Any open rate for the same category and site is closed the day before this date.">
            <input id="rc-from" type="date" value={form.effectiveFrom} onChange={(event) => update("effectiveFrom", event.target.value)} />
          </Field>
          <Field label="Notes" htmlFor="rc-notes" error={errors.notes}>
            <textarea id="rc-notes" rows={3} maxLength={500} value={form.notes} placeholder="Optional notes for this rate" onChange={(event) => update("notes", event.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function ResolveRateDialog({ client, categories, sites, onClose }) {
  const [categoryId, setCategoryId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [onDate, setOnDate] = useState(todayDateString());
  const [result, setResult] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");

  async function handleResolve(event) {
    event.preventDefault();
    if (resolving) return;
    if (!categoryId) {
      setError("Choose a manpower category.");
      return;
    }
    setResolving(true);
    setError("");
    try {
      const data = await resolveClientRateCard(client.id, { categoryId, siteId, onDate });
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(errorMessage(err, "The applicable rate could not be resolved."));
    } finally {
      setResolving(false);
    }
  }

  const card = result && result.rateCard ? result.rateCard : null;

  return (
    <Modal
      wide
      title="Resolve applicable rate"
      description={`Find the rate card that applies to ${client.legalName || "this client"} on a chosen date. The backend decides; this screen shows its answer.`}
      onClose={onClose}
      footer={<button type="button" className="secondaryButton cmBtn" onClick={onClose}>Close</button>}
    >
      <form className="cmForm" onSubmit={handleResolve} noValidate>
        <div className="cmFormGrid">
          <div className="cmFormRow">
            <Field label="Manpower category" htmlFor="rr-category" required>
              <select id="rr-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Site" htmlFor="rr-site" hint="Leave as client-wide to resolve against the client-wide rate.">
              <select id="rr-site" value={siteId} onChange={(event) => setSiteId(event.target.value)}>
                <option value="">All sites (client-wide)</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>{site.displayLabel || `${site.siteCode} — ${site.siteName}`}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="On date" htmlFor="rr-date" required hint="Defaults to today.">
              <input id="rr-date" type="date" value={onDate} onChange={(event) => setOnDate(event.target.value)} />
            </Field>
            <div className="cmSwitchRow" style={{ display: "flex", alignItems: "flex-end" }}>
              <button type="submit" className="primaryButton cmBtn" disabled={resolving}>
                <SearchCheck size={15} /> {resolving ? "Resolving…" : "Resolve rate"}
              </button>
            </div>
          </div>
        </div>
      </form>

      {error && <p className="actionError" role="alert" style={{ marginTop: 16 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 18 }}>
          {result.ambiguous && (
            <p className="cmNotice cmNotice-warn" role="alert" style={{ marginBottom: 12 }}>
              <strong>Ambiguous result — overlapping rate cards.</strong> More than one rate card of equal specificity covers
              this date, so the applicable wage would depend on row order. Correct the overlapping rate cards.
            </p>
          )}
          {!result.ambiguous && result.resolution && (
            <Notice tone="info">{result.resolution}</Notice>
          )}

          {card ? (
            <div className="cmDetailGrid" style={{ marginTop: 14 }}>
              <DetailRow label="Category" value={`${card.categoryName || "—"}${card.skillLevel ? ` · ${skillLevelLabel(card.skillLevel)}` : ""}`} />
              <DetailRow label="Site" value={card.siteSpecific ? `${card.siteName || "Site"} (site-specific)` : "All sites (client-wide)"} />
              <DetailRow label="Monthly wage" value={formatMoney(card.monthlyWage)} />
              <DetailRow label="Billing rate" value={formatMoney(card.billingRate)} />
              <DetailRow label="Gross margin / worker" value={formatMargin(card.grossMarginPerWorker)} />
              <DetailRow label="Overtime rate / hour" value={formatMoney(card.otRatePerHour)} />
              <DetailRow label="Shift hours" value={card.shiftHours != null ? `${card.shiftHours} h` : "—"} />
              <DetailRow label="Effective" value={`${formatDate(card.effectiveFrom)} → ${card.effectiveTo ? formatDate(card.effectiveTo) : "Ongoing"}`} />
              <DetailRow label="Status" value={<RateStatusChip rate={card} />} />
              {card.notes && <DetailRow label="Notes" value={card.notes} wide />}
            </div>
          ) : (
            <div style={{ marginTop: 14 }}>
              <EmptyState
                icon={SearchCheck}
                title="No applicable rate"
                message={result.resolution || "No rate card covers the selected category, site and date."}
              />
            </div>
          )}

          {card && card.billingBelowWage && (
            <div style={{ marginTop: 14 }}>
              <Notice tone="warn">This resolved rate bills below the monthly wage and results in a loss per worker.</Notice>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function RateCardDetailDialog({ rateCardId, onClose }) {
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    getRateCard(rateCardId)
      .then((data) => { if (active) { setCard(data); setError(""); } })
      .catch((err) => { if (active) setError(errorMessage(err, "The rate card could not be loaded.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [rateCardId, reloadToken]);

  return (
    <Drawer
      size="lg"
      title="Rate card details"
      description={`Rate card #${rateCardId}`}
      onClose={onClose}
      footer={<button type="button" className="secondaryButton cmBtn" onClick={onClose}>Close</button>}
    >
      {loading ? (
        <LoadingState label="Loading rate card…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => { setLoading(true); setReloadToken((token) => token + 1); }} />
      ) : card ? (
        <>
          <div className="cmStatusRow" style={{ marginBottom: 12 }}>
            <RateStatusChip rate={card} />
            {card.siteSpecific ? <Chip tone="info">Site-specific</Chip> : <Chip tone="neutral">Client-wide</Chip>}
            {card.billingBelowWage && <Chip tone="danger">Billing below wage</Chip>}
          </div>

          <div className="cmDetailGrid">
            <DetailRow label="Client" value={card.clientName} />
            <DetailRow label="Category" value={card.categoryName} />
            <DetailRow label="Skill level" value={skillLevelLabel(card.skillLevel)} />
            <DetailRow label="Site" value={card.siteName || "All sites"} />
            <DetailRow label="Monthly wage" value={formatMoney(card.monthlyWage)} />
            <DetailRow label="Billing rate" value={formatMoney(card.billingRate)} />
            <DetailRow label="Gross margin / worker" value={formatMargin(card.grossMarginPerWorker)} />
            <DetailRow label="Overtime rate / hour" value={formatMoney(card.otRatePerHour)} />
            <DetailRow label="Shift hours" value={card.shiftHours != null ? `${card.shiftHours} h` : "—"} />
            <DetailRow label="Effective from" value={formatDate(card.effectiveFrom)} />
            <DetailRow label="Effective to" value={card.effectiveTo ? formatDate(card.effectiveTo) : "Ongoing (current rate)"} />
            <DetailRow label="Status" value={card.current ? "Current" : RATE_STATUS_LABELS[rateCardStatus(card)]} />
            {card.notes && <DetailRow label="Notes" value={card.notes} wide />}
          </div>

          {card.billingBelowWage && (
            <div style={{ marginTop: 14 }}>
              <Notice tone="warn">
                Billing rate is below the monthly wage — this rate results in a loss of {formatMoney(Math.abs(Number(card.grossMarginPerWorker) || 0))} per worker.
              </Notice>
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            {isFutureRate(card) ? (
              <Notice tone="info">This rate starts on {formatDate(card.effectiveFrom)} and can still be edited or deleted until then.</Notice>
            ) : (
              <Notice tone="info">This rate is already in effect or historical, so it cannot be edited or deleted. To change it, create a new rate card that supersedes it.</Notice>
            )}
          </div>
        </>
      ) : null}
    </Drawer>
  );
}

export default function RateCardsTab({ client, onChanged }) {
  const [rateCards, setRateCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState([]);
  const [sites, setSites] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");

  const [flash, showFlash] = useFlash();
  const [reloadToken, setReloadToken] = useState(0);

  const [formDialog, setFormDialog] = useState(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listClientRateCards(client.id);
        if (cancelled) return;
        setRateCards(data);
        setError("");
      } catch (err) {
        if (cancelled) return;
        setError(errorMessage(err, "Rate cards could not be loaded."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [client.id, reloadToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cats, siteList] = await Promise.all([listManpowerCategories(), listClientSites(client.id)]);
        if (cancelled) return;
        setCategories(Array.isArray(cats) ? cats : []);
        setSites(Array.isArray(siteList) ? siteList : []);
      } catch {
        // Non-fatal: pickers will be empty until the lists can be fetched.
      }
    })();
    return () => { cancelled = true; };
  }, [client.id]);

  function reload() {
    setLoading(true);
    setReloadToken((token) => token + 1);
    if (typeof onChanged === "function") onChanged();
  }

  const stats = useMemo(() => {
    let current = 0;
    let future = 0;
    let siteSpecific = 0;
    let belowWage = 0;
    for (const rate of rateCards) {
      const status = rateCardStatus(rate);
      if (status === "current") current += 1;
      else if (status === "future") future += 1;
      if (rate.siteSpecific) siteSpecific += 1;
      if (rate.billingBelowWage) belowWage += 1;
    }
    return { current, future, siteSpecific, belowWage };
  }, [rateCards]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...rateCards]
      .sort((a, b) => String(b.effectiveFrom || "").localeCompare(String(a.effectiveFrom || "")))
      .filter((rate) => {
        if (statusFilter && rateCardStatus(rate) !== statusFilter) return false;
        if (scopeFilter === "site" && !rate.siteSpecific) return false;
        if (scopeFilter === "client" && rate.siteSpecific) return false;
        if (!query) return true;
        return [rate.categoryName, rate.siteName, rate.notes, skillLevelLabel(rate.skillLevel)].some((value) =>
          String(value || "").toLowerCase().includes(query),
        );
      });
  }, [rateCards, search, statusFilter, scopeFilter]);

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteRateCard(deleteTarget.id);
      showFlash("success", "Rate card deleted.");
      setDeleteTarget(null);
      reload();
    } catch (err) {
      showFlash("error", errorMessage(err, "The rate card could not be deleted."));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <FlashBanner flash={flash} />

      <div className="cmStatusRow" style={{ marginTop: 16 }}>
        <Chip tone="success">{stats.current} current</Chip>
        <Chip tone="accent">{stats.future} upcoming</Chip>
        <Chip tone="info">{stats.siteSpecific} site-specific</Chip>
        {stats.belowWage > 0 && <Chip tone="danger">{stats.belowWage} below wage</Chip>}
        <Chip tone="neutral">{rateCards.length} total</Chip>
      </div>

      <div className="cmToolbar" style={{ marginTop: 12 }}>
        <label className="cmSearchBox">
          <Search size={15} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search category, site or notes"
            aria-label="Search rate cards"
          />
        </label>
        <div className="cmToolbarControls">
          <label className="cmSelect">
            <ListFilter size={14} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              <option value="current">Current</option>
              <option value="future">Upcoming</option>
              <option value="historical">Historical</option>
            </select>
          </label>
          <label className="cmSelect">
            <MapPin size={14} />
            <select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)}>
              <option value="">All scopes</option>
              <option value="client">Client-wide</option>
              <option value="site">Site-specific</option>
            </select>
          </label>
          <button type="button" className="secondaryButton cmBtn" onClick={() => setResolveOpen(true)}>
            <SearchCheck size={15} /> Resolve rate
          </button>
          <button type="button" className="secondaryButton cmBtn" onClick={reload} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </button>
          <button type="button" className="primaryButton cmBtn" onClick={() => setFormDialog({ rate: null })}>
            <Plus size={15} /> Add rate card
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading rate cards…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={IndianRupee}
          title={rateCards.length ? "No rate cards match your filters" : "No rate cards yet"}
          message={
            rateCards.length
              ? "Adjust the search or filters to see rate cards."
              : "Add the first rate card to agree a wage and billing rate for this client."
          }
        />
      ) : (
        <div className="cmTableWrap">
          <table className="cmTable">
            <thead>
              <tr>
                <th>Category</th>
                <th>Site</th>
                <th>Wage</th>
                <th>Billing / margin</th>
                <th>OT / shift</th>
                <th>Effective</th>
                <th className="cmColCenter">Status</th>
                <th className="cmColActions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rate) => {
                const editable = isFutureRate(rate);
                return (
                  <tr key={rate.id}>
                    <td>
                      <div className="cmEntity">
                        <span className="cmIconTile"><IndianRupee size={16} /></span>
                        <span>
                          <strong>{rate.categoryName || "—"}</strong>
                          <small className="cmBlock">
                            <Chip tone={SKILL_LEVEL_TONES[rate.skillLevel] || "neutral"}>{skillLevelLabel(rate.skillLevel)}</Chip>
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      {rate.siteSpecific ? (
                        <span>
                          <strong className="cmBlock">{rate.siteName || "Site"}</strong>
                          <Chip tone="info">Site-specific</Chip>
                        </span>
                      ) : (
                        <span>
                          <strong className="cmBlock">All sites</strong>
                          <Chip tone="neutral">Client-wide</Chip>
                        </span>
                      )}
                    </td>
                    <td className="cmMuted">{formatMoney(rate.monthlyWage)}</td>
                    <td>
                      <span className="cmBlock"><strong>{formatMoney(rate.billingRate)}</strong></span>
                      <small className={rate.billingBelowWage ? "cmFieldError" : "cmMuted"}>
                        {formatMargin(rate.grossMarginPerWorker)} margin
                      </small>
                      {rate.billingBelowWage && (
                        <span className="cmBlock"><Chip tone="danger">Below wage</Chip></span>
                      )}
                    </td>
                    <td className="cmMuted">
                      <span className="cmBlock">{formatMoney(rate.otRatePerHour)}{rate.otRatePerHour != null ? "/hr" : ""}</span>
                      <small>{rate.shiftHours != null ? `${rate.shiftHours} h shift` : "—"}</small>
                    </td>
                    <td className="cmMuted">
                      <span className="cmBlock">{formatDate(rate.effectiveFrom)}</span>
                      <small>{rate.effectiveTo ? `to ${formatDate(rate.effectiveTo)}` : "Ongoing"}</small>
                    </td>
                    <td className="cmColCenter"><RateStatusChip rate={rate} /></td>
                    <td className="cmColActions">
                      <div className="cmRowActions">
                        <button type="button" className="cmIconButton" title="View details" aria-label="View rate card details" onClick={() => setDetailId(rate.id)}>
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          className="cmIconButton"
                          title={editable ? "Edit rate card" : "Only future rate cards can be edited — create a new rate to supersede an effective rate."}
                          aria-label="Edit rate card"
                          disabled={!editable}
                          onClick={() => setFormDialog({ rate })}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="cmIconButton cmIconDanger"
                          title={editable ? "Delete rate card" : "Only future rate cards can be deleted."}
                          aria-label="Delete rate card"
                          disabled={!editable}
                          onClick={() => setDeleteTarget(rate)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {formDialog && (
        <RateCardFormDialog
          client={client}
          categories={categories}
          sites={sites}
          rate={formDialog.rate}
          onClose={() => setFormDialog(null)}
          onDone={(message) => {
            setFormDialog(null);
            showFlash("success", message);
            reload();
          }}
        />
      )}

      {resolveOpen && (
        <ResolveRateDialog
          client={client}
          categories={categories}
          sites={sites}
          onClose={() => setResolveOpen(false)}
        />
      )}

      {detailId && <RateCardDetailDialog rateCardId={detailId} onClose={() => setDetailId(null)} />}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete rate card"
          message={`Delete the ${deleteTarget.siteSpecific ? `site-specific (${deleteTarget.siteName})` : "client-wide"} rate for “${deleteTarget.categoryName}” effective from ${formatDate(deleteTarget.effectiveFrom)}? This only works while the rate has not taken effect. Historical rates are never removed.`}
          confirmLabel="Delete rate card"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => { if (!deleting) setDeleteTarget(null); }}
        />
      )}
    </div>
  );
}