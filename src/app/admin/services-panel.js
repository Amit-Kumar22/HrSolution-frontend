"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  ImagePlus,
  Layers,
  Pencil,
  Plus,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { SERVICE_ICONS } from "@/lib/public-icons";
import { resolvePublicFileUrl } from "@/lib/publicApi";
import {
  createService,
  deleteService,
  listServices,
  publishService,
  updateService,
  uploadServiceHeroImage,
  validateImageFile,
} from "@/lib/adminApi";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  FlashBanner,
  LoadingState,
  Modal,
  Notice,
  SectionHead,
  Switch,
  useFlash,
  SLUG_PATTERN,
  slugify,
} from "./admin-ui";

const EMPTY_FORM = {
  slug: "",
  title: "",
  summary: "",
  description: "",
  icon: "",
  heroImagePath: "",
  metaTitle: "",
  metaDescription: "",
  displayOrder: "",
  published: false,
};

const ICON_OPTIONS = Object.keys(SERVICE_ICONS);

function itemToForm(item) {
  return {
    slug: item.slug || "",
    title: item.title || "",
    summary: item.summary || "",
    description: item.description || "",
    icon: item.icon || "",
    heroImagePath: item.heroImagePath || "",
    metaTitle: item.metaTitle || "",
    metaDescription: item.metaDescription || "",
    displayOrder: item.displayOrder ?? "",
    published: Boolean(item.published),
  };
}

function formToPayload(form) {
  return {
    slug: form.slug.trim(),
    title: form.title.trim(),
    summary: form.summary.trim(),
    description: form.description.trim(),
    icon: form.icon.trim(),
    metaTitle: form.metaTitle.trim(),
    metaDescription: form.metaDescription.trim(),
    displayOrder: form.displayOrder === "" || form.displayOrder == null ? 0 : Number(form.displayOrder),
    published: Boolean(form.published),
  };
}

function validate(form) {
  const errors = {};
  if (!form.title.trim()) errors.title = "Title is required.";
  else if (form.title.trim().length > 160) errors.title = "Title must be 160 characters or fewer.";
  if (!form.slug.trim()) errors.slug = "Slug is required.";
  else if (!SLUG_PATTERN.test(form.slug.trim())) {
    errors.slug = "Use lowercase letters, numbers and single hyphens only.";
  }
  if (!form.summary.trim()) errors.summary = "Summary is required.";
  else if (form.summary.trim().length > 400) errors.summary = "Summary must be 400 characters or fewer.";
  if (form.description.trim().length > 20000) errors.description = "Description is too long.";
  if (form.icon.trim().length > 60) errors.icon = "Icon name must be 60 characters or fewer.";
  if (form.metaTitle.trim().length > 160) errors.metaTitle = "Meta title must be 160 characters or fewer.";
  if (form.metaDescription.trim().length > 320) errors.metaDescription = "Meta description must be 320 characters or fewer.";
  if (form.displayOrder !== "" && !Number.isFinite(Number(form.displayOrder))) {
    errors.displayOrder = "Display order must be a whole number.";
  }
  return errors;
}

export default function ServicesPanel() {
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

  const [heroFile, setHeroFile] = useState(null);
  const [heroPreview, setHeroPreview] = useState("");
  const [heroError, setHeroError] = useState("");
  const [heroUploading, setHeroUploading] = useState(false);
  const heroPreviewRef = useRef("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [unpublishing, setUnpublishing] = useState(false);

  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listServices();
        if (cancelled) return;
        setItems(data);
        setLoadError("");
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Services could not be loaded.");
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
      [item.title, item.slug, item.summary].some((value) =>
        String(value || "").toLowerCase().includes(query),
      ),
    );
  }, [items, search]);

  const publishedCount = items.filter((item) => item.published).length;
  const editingService = editingId === null ? null : items.find((item) => item.id === editingId) || null;

  function resetHero() {
    if (heroPreviewRef.current) URL.revokeObjectURL(heroPreviewRef.current);
    heroPreviewRef.current = "";
    setHeroFile(null);
    setHeroPreview("");
    setHeroError("");
    setHeroUploading(false);
  }

  function openCreate() {
    const nextOrder = items.reduce((max, item) => Math.max(max, Number(item.displayOrder) || 0), 0) + 10;
    setEditingId(null);
    setForm({ ...EMPTY_FORM, displayOrder: nextOrder });
    setFormErrors({});
    setFormError("");
    resetHero();
    setFormOpen(true);
  }

  function openEdit(item) {
    setEditingId(item.id);
    setForm(itemToForm(item));
    setFormErrors({});
    setFormError("");
    resetHero();
    setFormOpen(true);
  }

  function closeForm() {
    if (saving || heroUploading) return;
    setFormOpen(false);
    resetHero();
  }

  function updateForm(key, value) {
    setForm((previous) => {
      const next = { ...previous, [key]: value };
      if (key === "title" && editingId === null && !previous.slugTouched) {
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

  async function performHeroUpload(serviceId, file) {
    setHeroUploading(true);
    setHeroError("");
    try {
      const updated = await uploadServiceHeroImage(serviceId, file);
      if (updated && updated.heroImagePath) {
        setForm((previous) => ({ ...previous, heroImagePath: updated.heroImagePath }));
        setItems((previous) =>
          previous.map((entry) => (entry.id === serviceId ? { ...entry, heroImagePath: updated.heroImagePath } : entry)),
        );
      }
      resetHero();
      showFlash("success", "Hero image uploaded.");
      return true;
    } catch (error) {
      setHeroError(error instanceof Error ? error.message : "The hero image could not be uploaded.");
      return false;
    } finally {
      setHeroUploading(false);
    }
  }

  function handleHeroSelect(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setHeroError(validationError);
      return;
    }
    if (heroPreviewRef.current) URL.revokeObjectURL(heroPreviewRef.current);
    const objectUrl = URL.createObjectURL(file);
    heroPreviewRef.current = objectUrl;
    setHeroPreview(objectUrl);
    setHeroError("");
    setHeroFile(file);
    if (editingId !== null) {
      performHeroUpload(editingId, file);
    }
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
        const created = await createService(payload);
        showFlash("success", `“${payload.title}” was created as a draft.`);
        if (created && created.id && heroFile) {
          await uploadServiceHeroImage(created.id, heroFile);
        }
        setFormOpen(false);
        resetHero();
        reload();
      } else {
        await updateService(editingId, payload);
        showFlash("success", `“${payload.title}” was updated.`);
        setFormOpen(false);
        resetHero();
        reload();
      }
    } catch (error) {
      if (error && error.fields && Object.keys(error.fields).length) {
        setFormErrors(error.fields);
      }
      setFormError(error instanceof Error ? error.message : "The service could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(item) {
    if (busyId) return;
    setBusyId(item.id);
    try {
      const updated = await publishService(item.id, !item.published);
      setItems((previous) =>
        previous.map((entry) =>
          entry.id === item.id ? { ...entry, published: Boolean(updated?.published ?? !item.published) } : entry,
        ),
      );
      showFlash("success", `“${item.title}” is now ${item.published ? "unpublished" : "published"}.`);
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "Publication status could not be changed.");
    } finally {
      setBusyId(null);
    }
  }

  async function unpublishForSlugEdit() {
    if (editingId === null || unpublishing) return;
    setUnpublishing(true);
    try {
      const updated = await publishService(editingId, false);
      setForm((previous) => ({ ...previous, published: Boolean(updated?.published ?? false) }));
      setItems((previous) =>
        previous.map((entry) => (entry.id === editingId ? { ...entry, published: false } : entry)),
      );
      showFlash("success", "Service unpublished. You can now change the slug.");
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "The service could not be unpublished.");
    } finally {
      setUnpublishing(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      if (deleteTarget.published) {
        await publishService(deleteTarget.id, false);
      }
      await deleteService(deleteTarget.id);
      showFlash("success", `“${deleteTarget.title}” was deleted.`);
      setDeleteTarget(null);
      reload();
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "The service could not be deleted.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const FormIcon = SERVICE_ICONS[String(form.icon || "").trim().toLowerCase()] || BriefcaseBusiness;
  const heroUrl = heroPreview || resolvePublicFileUrl(form.heroImagePath);
  const slugLocked = Boolean(editingId !== null && form.published);

  return (
    <div className="cmServicesPanel">
      <SectionHead
        title="Services"
        description={`Manage service pages. ${publishedCount} of ${items.length} published. Only published services appear on the website.`}
      />

      <FlashBanner flash={flash} />

      <div className="cmToolbar cmToolbarNowrap">
        <label className="cmSearchBox">
          <Search size={15} />
          <input
            type="search"
            placeholder="Search services…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search services"
          />
        </label>
        <div className="cmToolbarControls">
          <span className="cmCount">{filtered.length} of {items.length}</span>
          <button type="button" className="primaryButton cmBtn cmPageBtn" onClick={openCreate}>
            <Plus size={14} /> New service
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading services…" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Layers}
          title={items.length ? "No services match your search" : "No services yet"}
          message={items.length ? "Try a different search term." : "Create your first service page to show it here and on the website."}
        />
      ) : (
        <div className="cmTableWrap">
          <table className="cmTable">
            <thead>
              <tr>
                <th>Service</th>
                <th>Slug</th>
                <th>Summary</th>
                <th className="cmColCenter">Order</th>
                <th className="cmColCenter">Status</th>
                <th className="cmColActions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const RowIcon = SERVICE_ICONS[String(item.icon || "").trim().toLowerCase()] || BriefcaseBusiness;
                const thumb = resolvePublicFileUrl(item.heroImagePath);
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="cmEntity">
                        {thumb ? (
                          <img className="cmThumb" src={thumb} alt="" />
                        ) : (
                          <span className="cmIconTile"><RowIcon size={17} /></span>
                        )}
                        <strong>{item.title}</strong>
                      </div>
                    </td>
                    <td><code className="cmCode">{item.slug}</code></td>
                    <td className="cmMuted cmCellWrap">{item.summary || "—"}</td>
                    <td className="cmColCenter">{item.displayOrder ?? 0}</td>
                    <td className="cmColCenter">
                      <Switch
                        id={`service-pub-${item.id}`}
                        checked={item.published}
                        disabled={busyId === item.id}
                        onChange={() => togglePublished(item)}
                        label={busyId === item.id ? "Saving…" : item.published ? "Published" : "Draft"}
                      />
                    </td>
                    <td className="cmColActions">
                      <div className="cmRowActions">
                        <button type="button" className="cmIconButton" aria-label={`Edit ${item.title}`} onClick={() => openEdit(item)}>
                          <Pencil size={15} />
                        </button>
                        <button type="button" className="cmIconButton cmIconDanger" aria-label={`Delete ${item.title}`} onClick={() => setDeleteTarget(item)}>
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
          wide
          title={editingId === null ? "New service" : "Edit service"}
          description="Publish to make the page visible on the website."
          onClose={closeForm}
          footer={(
            <>
              <button type="button" className="secondaryButton cmBtn" onClick={closeForm} disabled={saving || heroUploading}>
                Cancel
              </button>
              <button type="submit" form="service-form" className="primaryButton cmBtn" disabled={saving || heroUploading}>
                {saving ? "Saving…" : editingId === null ? "Create service" : "Save changes"}
              </button>
            </>
          )}
        >
          <form id="service-form" className="cmForm" onSubmit={handleSubmit} noValidate>
            {formError && <p className="actionError" role="alert">{formError}</p>}
            <div className="cmFormGrid">
              <div className="cmFormRow">
                <Field label="Title" htmlFor="service-title" required error={formErrors.title}>
                  <input
                    id="service-title"
                    value={form.title}
                    maxLength={160}
                    placeholder="e.g. Manpower Supply"
                    onChange={(event) => updateForm("title", event.target.value)}
                  />
                </Field>
                <Field
                  label="Slug"
                  htmlFor="service-slug"
                  required
                  error={formErrors.slug}
                  hint={slugLocked ? "A published service's slug cannot be changed. Unpublish it first." : "URL segment, e.g. manpower-supply"}
                >
                  <input
                    id="service-slug"
                    value={form.slug}
                    maxLength={120}
                    placeholder="manpower-supply"
                    disabled={slugLocked}
                    onChange={(event) => updateSlug(event.target.value)}
                  />
                </Field>
              </div>

              {slugLocked && (
                <div className="cmInlineNote">
                  <Notice tone="warn">
                    This service is published. Changing the slug would break existing links.
                  </Notice>
                  <button
                    type="button"
                    className="secondaryButton cmBtn"
                    onClick={unpublishForSlugEdit}
                    disabled={unpublishing}
                  >
                    {unpublishing ? "Unpublishing…" : "Unpublish to edit slug"}
                  </button>
                </div>
              )}

              <Field label="Summary" htmlFor="service-summary" required error={formErrors.summary} hint="Shown on the services cards. Max 400 characters.">
                <textarea
                  id="service-summary"
                  value={form.summary}
                  maxLength={400}
                  rows={2}
                  placeholder="Short one-line summary"
                  onChange={(event) => updateForm("summary", event.target.value)}
                />
              </Field>

              <Field label="Description" htmlFor="service-description" error={formErrors.description} hint="Full page body shown on the service detail page.">
                <textarea
                  id="service-description"
                  value={form.description}
                  rows={5}
                  placeholder="Describe the service in detail"
                  onChange={(event) => updateForm("description", event.target.value)}
                />
              </Field>

              <div className="cmFormRow">
                <Field label="Icon" htmlFor="service-icon" error={formErrors.icon} hint="Icon key such as users, shield, truck">
                  <input
                    id="service-icon"
                    value={form.icon}
                    maxLength={60}
                    list="service-icon-options"
                    placeholder="users"
                    onChange={(event) => updateForm("icon", event.target.value)}
                  />
                </Field>
                <datalist id="service-icon-options">
                  {ICON_OPTIONS.map((option) => <option key={option} value={option} />)}
                </datalist>
                <Field label="Display order" htmlFor="service-order" error={formErrors.displayOrder} hint="Lower numbers appear first">
                  <input
                    id="service-order"
                    type="number"
                    value={form.displayOrder}
                    placeholder="10"
                    onChange={(event) => updateForm("displayOrder", event.target.value)}
                  />
                </Field>
              </div>

              <div className="cmIconPreviewRow">
                <span className="cmIconTile">{FormIcon ? <FormIcon size={18} /> : <BriefcaseBusiness size={18} />}</span>
                <span className="cmMuted">Icon preview</span>
              </div>

              <div className="cmFormRow">
                <Field label="Meta title" htmlFor="service-meta-title" error={formErrors.metaTitle} hint="SEO title. Max 160 characters.">
                  <input
                    id="service-meta-title"
                    value={form.metaTitle}
                    maxLength={160}
                    placeholder="SEO title"
                    onChange={(event) => updateForm("metaTitle", event.target.value)}
                  />
                </Field>
                <Field label="Meta description" htmlFor="service-meta-description" error={formErrors.metaDescription} hint="SEO description. Max 320 characters.">
                  <input
                    id="service-meta-description"
                    value={form.metaDescription}
                    maxLength={320}
                    placeholder="SEO description"
                    onChange={(event) => updateForm("metaDescription", event.target.value)}
                  />
                </Field>
              </div>

              <div className="cmHeroBlock">
                <span className="cmFieldLabel">Hero image</span>
                <div className="cmHeroRow">
                  <div className="cmHeroPreview">
                    {heroUrl ? (
                      <img src={heroUrl} alt="Hero preview" />
                    ) : (
                      <span className="cmHeroPlaceholder"><ImagePlus size={20} /> No image</span>
                    )}
                  </div>
                  <div className="cmHeroControls">
                    <label className="secondaryButton cmBtn cmFileButton">
                      <UploadCloud size={15} />
                      {heroUploading ? "Uploading…" : heroUrl ? "Replace image" : "Choose image"}
                      <input type="file" accept="image/png,image/jpeg,image/gif" onChange={handleHeroSelect} disabled={heroUploading} hidden />
                    </label>
                    <small className="cmHint">PNG, JPEG or GIF · up to 2 MB. {editingId === null ? "Uploaded right after the service is created." : "Uploads immediately."}</small>
                  </div>
                </div>
                {heroError && <small className="cmFieldError" role="alert">{heroError}</small>}
              </div>

              <div className="cmSwitchRow">
                <Switch
                  id="service-published"
                  checked={form.published}
                  onChange={(value) => updateForm("published", value)}
                  label={form.published ? "Published — visible on the website" : "Draft — hidden from the website"}
                />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete service"
          message={
            deleteTarget.published
              ? `“${deleteTarget.title}” is published. It will be unpublished first, then permanently deleted. This cannot be undone.`
              : `Delete “${deleteTarget.title}”? This removes its page from the website and cannot be undone.`
          }
          confirmLabel="Delete service"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => { if (!deleting) setDeleteTarget(null); }}
        />
      )}
    </div>
  );
}
