"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Factory, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { INDUSTRY_ICONS } from "@/lib/public-icons";
import {
  createIndustry,
  deleteIndustry,
  listIndustries,
  updateIndustry,
} from "@/lib/adminApi";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  FlashBanner,
  LoadingState,
  Modal,
  SectionHead,
  Switch,
  useFlash,
  SLUG_PATTERN,
  slugify,
} from "./admin-ui";

const EMPTY_FORM = {
  name: "",
  slug: "",
  description: "",
  icon: "",
  displayOrder: "",
  published: false,
};

const ICON_OPTIONS = Object.keys(INDUSTRY_ICONS);

function itemToForm(item) {
  return {
    name: item.name || "",
    slug: item.slug || "",
    description: item.description || "",
    icon: item.icon || "",
    displayOrder: item.displayOrder ?? "",
    published: Boolean(item.published),
  };
}

function formToPayload(form) {
  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    description: form.description.trim(),
    icon: form.icon.trim(),
    displayOrder: form.displayOrder === "" || form.displayOrder == null ? 0 : Number(form.displayOrder),
    published: Boolean(form.published),
  };
}

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Industry name is required.";
  else if (form.name.trim().length > 120) errors.name = "Name must be 120 characters or fewer.";
  if (!form.slug.trim()) errors.slug = "Slug is required.";
  else if (!SLUG_PATTERN.test(form.slug.trim())) {
    errors.slug = "Use lowercase letters, numbers and single hyphens only.";
  }
  if (form.description.trim().length > 600) errors.description = "Description must be 600 characters or fewer.";
  if (form.icon.trim().length > 60) errors.icon = "Icon name must be 60 characters or fewer.";
  if (form.displayOrder !== "" && !Number.isFinite(Number(form.displayOrder))) {
    errors.displayOrder = "Display order must be a whole number.";
  }
  return errors;
}

export default function IndustriesPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [flash, showFlash] = useFlash();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listIndustries();
        if (cancelled) return;
        setItems(data);
        setLoadError("");
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Industries could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reload = useCallback(() => {
    setLoading(true);
    setReloadToken((token) => token + 1);
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sorted = [...items].sort(
      (a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0),
    );
    if (!query) return sorted;
    return sorted.filter((item) =>
      [item.name, item.slug, item.description].some((value) =>
        String(value || "").toLowerCase().includes(query),
      ),
    );
  }, [items, search]);

  function openCreate() {
    const nextOrder = items.reduce((max, item) => Math.max(max, Number(item.displayOrder) || 0), 0) + 10;
    setEditingId(null);
    setForm({ ...EMPTY_FORM, displayOrder: nextOrder });
    setFormErrors({});
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(item) {
    setEditingId(item.id);
    setForm(itemToForm(item));
    setFormErrors({});
    setFormError("");
    setFormOpen(true);
  }

  function updateForm(key, value) {
    setForm((previous) => {
      const next = { ...previous, [key]: value };
      if (key === "name" && (editingId === null) && !previous.slugTouched) {
        next.slug = slugify(value);
      }
      return next;
    });
    setFormErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  function updateSlug(value) {
    setForm((previous) => ({ ...previous, slug: value, slugTouched: true }));
    setFormErrors((previous) => {
      if (!previous.slug) return previous;
      const next = { ...previous };
      delete next.slug;
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    const errors = validate(form);
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      setFormError("Please correct the highlighted fields and try again.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const payload = formToPayload(form);
      if (editingId === null) {
        await createIndustry(payload);
        showFlash("success", `“${payload.name}” was created.`);
      } else {
        await updateIndustry(editingId, payload);
        showFlash("success", `“${payload.name}” was updated.`);
      }
      setFormOpen(false);
      reload();
    } catch (error) {
      if (error && error.fields && Object.keys(error.fields).length) {
        setFormErrors(error.fields);
      }
      setFormError(error instanceof Error ? error.message : "The industry could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(item) {
    if (busyId) return;
    setBusyId(item.id);
    try {
      await updateIndustry(item.id, { ...itemToPayload(item), published: !item.published });
      setItems((previous) =>
        previous.map((entry) => (entry.id === item.id ? { ...entry, published: !item.published } : entry)),
      );
      showFlash("success", `“${item.name}” is now ${item.published ? "unpublished" : "published"}.`);
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "Publication status could not be changed.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteIndustry(deleteTarget.id);
      showFlash("success", `“${deleteTarget.name}” was deleted.`);
      setDeleteTarget(null);
      reload();
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "The industry could not be deleted.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const Icon = INDUSTRY_ICONS[String(form.icon || "").trim().toLowerCase()] || null;

  return (
    <div className="cmIndustriesPanel">
      <SectionHead
        title="Industries"
        description="Manage the industries shown on the public website. Only published industries are displayed publicly."
      />

      <FlashBanner flash={flash} />

      <div className="cmToolbar cmToolbarNowrap">
        <label className="cmSearchBox">
          <Search size={15} />
          <input
            type="search"
            placeholder="Search industries…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search industries"
          />
        </label>
        <div className="cmToolbarControls">
          <span className="cmCount">{filtered.length} of {items.length}</span>
          <button type="button" className="primaryButton cmBtn cmPageBtn" onClick={openCreate}>
            <Plus size={14} /> New industry
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading industries…" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Factory}
          title={items.length ? "No industries match your search" : "No industries yet"}
          message={items.length ? "Try a different search term." : "Create your first industry to show it here and on the website."}
        />
      ) : (
        <div className="cmTableWrap">
          <table className="cmTable">
            <thead>
              <tr>
                <th>Industry</th>
                <th>Slug</th>
                <th>Description</th>
                <th className="cmColCenter">Order</th>
                <th className="cmColCenter">Status</th>
                <th className="cmColActions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const RowIcon = INDUSTRY_ICONS[String(item.icon || "").trim().toLowerCase()] || Building2;
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="cmEntity">
                        <span className="cmIconTile"><RowIcon size={17} /></span>
                        <strong>{item.name}</strong>
                      </div>
                    </td>
                    <td><code className="cmCode">{item.slug}</code></td>
                    <td className="cmMuted cmCellWrap">{item.description || "—"}</td>
                    <td className="cmColCenter">{item.displayOrder ?? 0}</td>
                    <td className="cmColCenter">
                      <Switch
                        id={`industry-pub-${item.id}`}
                        checked={item.published}
                        disabled={busyId === item.id}
                        onChange={() => togglePublished(item)}
                        label={busyId === item.id ? "Saving…" : item.published ? "Published" : "Draft"}
                      />
                    </td>
                    <td className="cmColActions">
                      <div className="cmRowActions">
                        <button type="button" className="cmIconButton" aria-label={`Edit ${item.name}`} onClick={() => openEdit(item)}>
                          <Pencil size={15} />
                        </button>
                        <button type="button" className="cmIconButton cmIconDanger" aria-label={`Delete ${item.name}`} onClick={() => setDeleteTarget(item)}>
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

      {formOpen && (
        <Modal
          title={editingId === null ? "New industry" : "Edit industry"}
          description="Industries appear on the public website in display order once published."
          onClose={() => { if (!saving) setFormOpen(false); }}
          footer={(
            <>
              <button type="button" className="secondaryButton cmBtn" onClick={() => setFormOpen(false)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" form="industry-form" className="primaryButton cmBtn" disabled={saving}>
                {saving ? "Saving…" : editingId === null ? "Create industry" : "Save changes"}
              </button>
            </>
          )}
        >
          <form id="industry-form" className="cmForm" onSubmit={handleSubmit} noValidate>
            {formError && <p className="actionError" role="alert">{formError}</p>}
            <div className="cmFormGrid">
              <Field label="Industry name" htmlFor="industry-name" required error={formErrors.name}>
                <input
                  id="industry-name"
                  value={form.name}
                  maxLength={120}
                  placeholder="e.g. Manufacturing & Factories"
                  onChange={(event) => updateForm("name", event.target.value)}
                />
              </Field>
              <Field label="Slug" htmlFor="industry-slug" required error={formErrors.slug} hint="URL-friendly identifier, e.g. manufacturing">
                <input
                  id="industry-slug"
                  value={form.slug}
                  maxLength={120}
                  placeholder="manufacturing"
                  onChange={(event) => updateSlug(event.target.value)}
                />
              </Field>
              <Field label="Description" htmlFor="industry-description" error={formErrors.description}>
                <textarea
                  id="industry-description"
                  value={form.description}
                  maxLength={600}
                  rows={3}
                  placeholder="Short description shown on the website"
                  onChange={(event) => updateForm("description", event.target.value)}
                />
              </Field>
              <div className="cmFormRow">
                <Field label="Icon" htmlFor="industry-icon" error={formErrors.icon} hint="Icon key such as factory, truck, hospital">
                  <input
                    id="industry-icon"
                    value={form.icon}
                    maxLength={60}
                    list="industry-icon-options"
                    placeholder="factory"
                    onChange={(event) => updateForm("icon", event.target.value)}
                  />
                </Field>
                <datalist id="industry-icon-options">
                  {ICON_OPTIONS.map((option) => <option key={option} value={option} />)}
                </datalist>
                <Field label="Display order" htmlFor="industry-order" error={formErrors.displayOrder} hint="Lower numbers appear first">
                  <input
                    id="industry-order"
                    type="number"
                    value={form.displayOrder}
                    placeholder="10"
                    onChange={(event) => updateForm("displayOrder", event.target.value)}
                  />
                </Field>
              </div>
              <div className="cmInlinePreview">
                <span className="cmIconTile">{Icon ? <Icon size={18} /> : <Building2 size={18} />}</span>
                <span className="cmMuted">Icon preview</span>
              </div>
              <div className="cmSwitchRow">
                <Switch
                  id="industry-published"
                  checked={form.published}
                  onChange={(value) => updateForm("published", value)}
                  label={form.published ? "Published — visible on the website" : "Unpublished — hidden from the website"}
                />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete industry"
          message={`Delete “${deleteTarget.name}”? This removes it from the website and cannot be undone.`}
          confirmLabel="Delete industry"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => { if (!deleting) setDeleteTarget(null); }}
        />
      )}
    </div>
  );
}
