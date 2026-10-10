"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Pencil,
  Plus,
  Quote,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { resolvePublicFileUrl } from "@/lib/publicApi";
import {
  createTestimonial,
  deleteTestimonial,
  listTestimonials,
  publishTestimonial,
  updateTestimonial,
  uploadTestimonialImage,
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
} from "./admin-ui";

const EMPTY_FORM = {
  clientName: "",
  clientCompany: "",
  designation: "",
  content: "",
  rating: "",
  displayOrder: "",
  published: true,
};

const SORT_OPTIONS = [
  { value: "displayOrder:asc", label: "Display order (ascending)" },
  { value: "displayOrder:desc", label: "Display order (descending)" },
  { value: "clientName:asc", label: "Client name (A–Z)" },
  { value: "clientName:desc", label: "Client name (Z–A)" },
];

const PAGE_SIZES = [5, 10, 20, 50];

function itemToForm(item) {
  return {
    clientName: item.clientName || "",
    clientCompany: item.clientCompany || "",
    designation: item.designation || "",
    content: item.content || "",
    rating: item.rating == null ? "" : String(item.rating),
    displayOrder: item.displayOrder ?? "",
    published: Boolean(item.published),
  };
}

function formToPayload(form, { includePublished }) {
  const payload = {
    clientName: form.clientName.trim(),
    clientCompany: form.clientCompany.trim(),
    designation: form.designation.trim(),
    content: form.content.trim(),
    displayOrder: form.displayOrder === "" || form.displayOrder == null ? 0 : Number(form.displayOrder),
  };
  if (form.rating !== "" && form.rating != null) payload.rating = Number(form.rating);
  if (includePublished) payload.published = Boolean(form.published);
  return payload;
}

function validate(form) {
  const errors = {};
  if (!form.clientName.trim()) errors.clientName = "Client name is required.";
  else if (form.clientName.trim().length > 120) errors.clientName = "Name must be 120 characters or fewer.";
  if (form.clientCompany.trim().length > 200) errors.clientCompany = "Company must be 200 characters or fewer.";
  if (form.designation.trim().length > 120) errors.designation = "Designation must be 120 characters or fewer.";
  if (!form.content.trim()) errors.content = "Testimonial content is required.";
  else if (form.content.trim().length > 1500) errors.content = "Content must be 1500 characters or fewer.";
  if (form.rating !== "" && form.rating != null) {
    const rating = Number(form.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      errors.rating = "Rating must be a whole number from 1 to 5.";
    }
  }
  if (form.displayOrder !== "" && !Number.isFinite(Number(form.displayOrder))) {
    errors.displayOrder = "Display order must be a whole number.";
  }
  return errors;
}

export default function TestimonialsPanel() {
  const [pageData, setPageData] = useState({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, first: true, last: true });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [flash, showFlash] = useFlash();

  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [sortValue, setSortValue] = useState("displayOrder:asc");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [imageState, setImageState] = useState({
    logo: { file: null, preview: "", uploading: false, error: "" },
    photo: { file: null, preview: "", uploading: false, error: "" },
  });
  const previewRefs = useRef({ logo: "", photo: "" });

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [sortKey, sortDir] = useMemo(() => {
    const [key, dir] = sortValue.split(":");
    return [key, dir];
  }, [sortValue]);

  const load = useCallback(async () => {
    try {
      const data = await listTestimonials({ page, size, sort: [`${sortKey},${sortDir}`] });
      setPageData(data);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Testimonials could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [page, size, sortKey, sortDir]);

  const reload = useCallback(async () => {
    setLoading(true);
    await load();
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  function resetImages() {
    for (const key of ["logo", "photo"]) {
      if (previewRefs.current[key]) URL.revokeObjectURL(previewRefs.current[key]);
      previewRefs.current[key] = "";
    }
    setImageState({
      logo: { file: null, preview: "", uploading: false, error: "" },
      photo: { file: null, preview: "", uploading: false, error: "" },
    });
  }

  function openCreate() {
    const nextOrder = pageData.content.reduce((max, item) => Math.max(max, Number(item.displayOrder) || 0), 0) + 10;
    setEditingId(null);
    setForm({ ...EMPTY_FORM, displayOrder: nextOrder });
    setFormErrors({});
    setFormError("");
    resetImages();
    setFormOpen(true);
  }

  function openEdit(item) {
    setEditingId(item.id);
    setForm(itemToForm(item));
    setFormErrors({});
    setFormError("");
    resetImages();
    setFormOpen(true);
  }

  function closeForm() {
    if (saving || imageState.logo.uploading || imageState.photo.uploading) return;
    setFormOpen(false);
    resetImages();
  }

  function updateForm(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setFormErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  function handleImageSelect(kind, event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file || editingId === null) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      setImageState((previous) => ({ ...previous, [kind]: { ...previous[kind], error: validationError } }));
      return;
    }

    if (previewRefs.current[kind]) URL.revokeObjectURL(previewRefs.current[kind]);
    const objectUrl = URL.createObjectURL(file);
    previewRefs.current[kind] = objectUrl;
    setImageState((previous) => ({
      ...previous,
      [kind]: { file, preview: objectUrl, uploading: true, error: "" },
    }));
    uploadImage(kind, file);
  }

  async function uploadImage(kind, file) {
    const isLogo = kind === "logo";
    try {
      const updated = await uploadTestimonialImage(editingId, file, { logo: isLogo });
      const storedPath = updated ? (isLogo ? updated.logoPath : updated.photoPath) : "";
      setPageData((previous) => ({
        ...previous,
        content: previous.content.map((entry) =>
          entry.id === editingId
            ? { ...entry, [isLogo ? "logoPath" : "photoPath"]: storedPath || entry[isLogo ? "logoPath" : "photoPath"] }
            : entry,
        ),
      }));
      if (previewRefs.current[kind]) URL.revokeObjectURL(previewRefs.current[kind]);
      previewRefs.current[kind] = "";
      setImageState((previous) => ({
        ...previous,
        [kind]: { file: null, preview: "", uploading: false, error: "" },
      }));
      showFlash("success", isLogo ? "Company logo uploaded." : "Client photo uploaded.");
    } catch (error) {
      setImageState((previous) => ({
        ...previous,
        [kind]: {
          ...previous[kind],
          uploading: false,
          error: error instanceof Error ? error.message : "The image could not be uploaded.",
        },
      }));
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
      if (editingId === null) {
        await createTestimonial(formToPayload(form, { includePublished: true }));
        showFlash(
          "success",
          form.published
            ? `“${form.clientName.trim()}” was created and is live on the website.`
            : `“${form.clientName.trim()}” was created as a draft.`,
        );
      } else {
        const payload = formToPayload(form, { includePublished: true });
        await updateTestimonial(editingId, payload);
        showFlash("success", `“${payload.clientName}” was updated.`);
      }
      setFormOpen(false);
      resetImages();
      if (editingId === null && page !== 0) {
        setPage(0);
      } else {
        await reload();
      }
    } catch (error) {
      if (error && error.fields && Object.keys(error.fields).length) {
        setFormErrors(error.fields);
      }
      setFormError(error instanceof Error ? error.message : "The testimonial could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(item) {
    if (busyId) return;
    setBusyId(item.id);
    try {
      const updated = await publishTestimonial(item.id, !item.published);
      setPageData((previous) => ({
        ...previous,
        content: previous.content.map((entry) =>
          entry.id === item.id ? { ...entry, published: Boolean(updated?.published ?? !item.published) } : entry,
        ),
      }));
      showFlash("success", `“${item.clientName}” is now ${item.published ? "unpublished" : "published"}.`);
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
      await deleteTestimonial(deleteTarget.id);
      showFlash("success", `“${deleteTarget.clientName}” was deleted.`);
      setDeleteTarget(null);
      if (pageData.content.length === 1 && page > 0) {
        setPage((current) => current - 1);
      } else {
        await reload();
      }
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "The testimonial could not be deleted.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = pageData.totalPages || 0;
  const current = Math.min(page + 1, Math.max(totalPages, 1));
  const editingItem = editingId === null ? null : pageData.content.find((item) => item.id === editingId) || null;

  const logoUrl = imageState.logo.preview || resolvePublicFileUrl(editingItem?.logoPath || "");
  const photoUrl = imageState.photo.preview || resolvePublicFileUrl(editingItem?.photoPath || "");

  return (
    <div>
      <SectionHead
        title="Testimonials"
        description="New testimonials go live on the website right away. Turn off “Publish on website” to keep one as a draft."
        action={(
          <button type="button" className="primaryButton cmBtn" onClick={openCreate}>
            <Plus size={16} /> New testimonial
          </button>
        )}
      />

      <FlashBanner flash={flash} />

      <div className="cmToolbar">
        <span className="cmCount">{pageData.totalElements} testimonial{pageData.totalElements === 1 ? "" : "s"}</span>
        <div className="cmToolbarControls">
          <label className="cmSelect">
            <span>Sort</span>
            <select value={sortValue} onChange={(event) => { setSortValue(event.target.value); setPage(0); }}>
              {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="cmSelect">
            <span>Per page</span>
            <select value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(0); }}>
              {PAGE_SIZES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading testimonials…" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : pageData.content.length === 0 ? (
        <EmptyState
          icon={Quote}
          title="No testimonials yet"
          message="Create a testimonial and it will appear on the website immediately."
        />
      ) : (
        <>
          <div className="cmTableWrap">
            <table className="cmTable">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Attribution</th>
                  <th>Testimonial</th>
                  <th className="cmColCenter">Rating</th>
                  <th className="cmColCenter">Images</th>
                  <th className="cmColCenter">Order</th>
                  <th className="cmColCenter">Status</th>
                  <th className="cmColActions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageData.content.map((item) => {
                  const logo = resolvePublicFileUrl(item.logoPath);
                  const photo = resolvePublicFileUrl(item.photoPath);
                  const initials = String(item.clientName || "?")
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part.charAt(0))
                    .join("")
                    .toUpperCase() || "?";
                  const attribution = item.attribution
                    || [item.designation, item.clientCompany].filter(Boolean).join(" · ");
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="cmEntity">
                          {photo ? (
                            <img className="cmAvatar" src={photo} alt="" />
                          ) : (
                            <span className="cmAvatar cmAvatarFallback">{initials}</span>
                          )}
                          <span>
                            <strong>{item.clientName}</strong>
                            {item.clientCompany && <small className="cmMuted cmBlock">{item.clientCompany}</small>}
                          </span>
                        </div>
                      </td>
                      <td className="cmMuted">{attribution || "—"}</td>
                      <td className="cmMuted cmCellWrap">{item.content || "—"}</td>
                      <td className="cmColCenter">{item.rating ? `${item.rating}★` : "—"}</td>
                      <td className="cmColCenter">
                        <div className="cmImageChips">
                          <span className={logo ? "cmChip cmChipOn" : "cmChip"}>Logo</span>
                          <span className={photo ? "cmChip cmChipOn" : "cmChip"}>Photo</span>
                        </div>
                      </td>
                      <td className="cmColCenter">{item.displayOrder ?? 0}</td>
                      <td className="cmColCenter">
                        <Switch
                          id={`testimonial-pub-${item.id}`}
                          checked={item.published}
                          disabled={busyId === item.id}
                          onChange={() => togglePublished(item)}
                          label={busyId === item.id ? "Saving…" : item.published ? "Published" : "Unpublished"}
                        />
                      </td>
                      <td className="cmColActions">
                        <div className="cmRowActions">
                          <button type="button" className="cmIconButton" aria-label={`Edit ${item.clientName}`} onClick={() => openEdit(item)}>
                            <Pencil size={15} />
                          </button>
                          <button type="button" className="cmIconButton cmIconDanger" aria-label={`Delete ${item.clientName}`} onClick={() => setDeleteTarget(item)}>
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

          <div className="cmPagination">
            <button
              type="button"
              className="secondaryButton cmBtn cmPageBtn"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page <= 0 || loading}
            >
              <ChevronLeft size={15} /> Previous
            </button>
            <span className="cmPageInfo">Page {current} of {Math.max(totalPages, 1)}</span>
            <button
              type="button"
              className="secondaryButton cmBtn cmPageBtn"
              onClick={() => setPage((current) => (current + 1 < totalPages ? current + 1 : current))}
              disabled={page + 1 >= totalPages || loading}
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </>
      )}

      {formOpen && (
        <Modal
          wide
          title={editingId === null ? "New testimonial" : "Edit testimonial"}
          description={editingId === null ? "New testimonials go live on the website right away." : "Update the testimonial and its images."}
          onClose={closeForm}
          footer={(
            <>
              <button type="button" className="secondaryButton cmBtn" onClick={closeForm} disabled={saving}>
                Cancel
              </button>
              <button type="submit" form="testimonial-form" className="primaryButton cmBtn" disabled={saving}>
                {saving ? "Saving…" : editingId === null ? "Create testimonial" : "Save changes"}
              </button>
            </>
          )}
        >
          <form id="testimonial-form" className="cmForm" onSubmit={handleSubmit} noValidate>
            {formError && <p className="actionError" role="alert">{formError}</p>}
            <div className="cmFormGrid">
              <div className="cmFormRow">
                <Field label="Client name" htmlFor="testimonial-name" required error={formErrors.clientName}>
                  <input
                    id="testimonial-name"
                    value={form.clientName}
                    maxLength={120}
                    placeholder="e.g. Rajesh Kulkarni"
                    onChange={(event) => updateForm("clientName", event.target.value)}
                  />
                </Field>
                <Field label="Client company" htmlFor="testimonial-company" error={formErrors.clientCompany}>
                  <input
                    id="testimonial-company"
                    value={form.clientCompany}
                    maxLength={200}
                    placeholder="e.g. Bharat Textiles Pvt Ltd"
                    onChange={(event) => updateForm("clientCompany", event.target.value)}
                  />
                </Field>
              </div>

              <div className="cmFormRow">
                <Field label="Designation" htmlFor="testimonial-designation" error={formErrors.designation}>
                  <input
                    id="testimonial-designation"
                    value={form.designation}
                    maxLength={120}
                    placeholder="e.g. Plant Head"
                    onChange={(event) => updateForm("designation", event.target.value)}
                  />
                </Field>
                <Field label="Rating" htmlFor="testimonial-rating" error={formErrors.rating} hint="Optional, 1 to 5 stars">
                  <select
                    id="testimonial-rating"
                    value={form.rating}
                    onChange={(event) => updateForm("rating", event.target.value)}
                  >
                    <option value="">No rating</option>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>{value} star{value === 1 ? "" : "s"}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Testimonial content" htmlFor="testimonial-content" required error={formErrors.content}>
                <textarea
                  id="testimonial-content"
                  value={form.content}
                  maxLength={1500}
                  rows={4}
                  placeholder="What did the client say?"
                  onChange={(event) => updateForm("content", event.target.value)}
                />
              </Field>

              <Field label="Display order" htmlFor="testimonial-order" error={formErrors.displayOrder} hint="Lower numbers appear first">
                <input
                  id="testimonial-order"
                  type="number"
                  value={form.displayOrder}
                  placeholder="10"
                  onChange={(event) => updateForm("displayOrder", event.target.value)}
                />
              </Field>

              <div className="cmSwitchRow">
                <Switch
                  id="testimonial-published"
                  checked={form.published}
                  onChange={(next) => updateForm("published", next)}
                  label={form.published ? "Publish on website" : "Saved as draft"}
                />
              </div>

              {editingId === null ? (
                <Notice tone="info">Save the testimonial first to add a company logo and client photo.</Notice>
              ) : (
                <div className="cmImageUploadGrid">
                  <div className="cmImageUpload">
                    <span className="cmFieldLabel">Company logo</span>
                    <div className="cmUploadPreview">
                      {logoUrl ? <img src={logoUrl} alt="" /> : <span className="cmUploadPlaceholder"><ImagePlus size={18} /></span>}
                    </div>
                    <label className="secondaryButton cmBtn cmFileButton">
                      <UploadCloud size={15} />
                      {imageState.logo.uploading ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif"
                        disabled={imageState.logo.uploading}
                        onChange={(event) => handleImageSelect("logo", event)}
                        hidden
                      />
                    </label>
                    {imageState.logo.error && <small className="cmFieldError" role="alert">{imageState.logo.error}</small>}
                  </div>

                  <div className="cmImageUpload">
                    <span className="cmFieldLabel">Client photo</span>
                    <div className="cmUploadPreview cmUploadPreviewRound">
                      {photoUrl ? <img src={photoUrl} alt="" /> : <span className="cmUploadPlaceholder"><ImagePlus size={18} /></span>}
                    </div>
                    <label className="secondaryButton cmBtn cmFileButton">
                      <UploadCloud size={15} />
                      {imageState.photo.uploading ? "Uploading…" : photoUrl ? "Replace photo" : "Upload photo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif"
                        disabled={imageState.photo.uploading}
                        onChange={(event) => handleImageSelect("photo", event)}
                        hidden
                      />
                    </label>
                    {imageState.photo.error && <small className="cmFieldError" role="alert">{imageState.photo.error}</small>}
                  </div>
                </div>
              )}

              {editingId !== null && (
                <p className="cmHint">
                  Use the Publish / Unpublish toggle in the list to control whether this testimonial appears on the website.
                </p>
              )}
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete testimonial"
          message={`Delete the testimonial from “${deleteTarget.clientName}”? This cannot be undone.`}
          confirmLabel="Delete testimonial"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => { if (!deleting) setDeleteTarget(null); }}
        />
      )}
    </div>
  );
}
