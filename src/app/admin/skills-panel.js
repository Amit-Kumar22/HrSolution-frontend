"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CirclePause, CirclePlay, Pencil, Plus, Search, Wrench } from "lucide-react";
import { createSkill, listSkills, setSkillActive, updateSkill } from "@/lib/adminApi";
import { skillFormToPayload, skillToForm, validateSkill } from "@/lib/manpower-forms";
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
} from "./admin-ui";

function SkillStatus({ active }) {
  return (
    <span className={`cmStatus ${active ? "cmStatusPublished" : "cmStatusDraft"}`}>
      <i />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function SkillsPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [flash, showFlash] = useFlash();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    active: true,
  });
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [statusTarget, setStatusTarget] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listSkills({ includeInactive: true });
        if (cancelled) return;
        setItems(data);
        setLoadError("");
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Skills could not be loaded.");
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
    const sorted = [...items].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    if (!query) return sorted;
    return sorted.filter((item) =>
      [item.name, item.description].some((value) =>
        String(value || "").toLowerCase().includes(query),
      ),
    );
  }, [items, search]);

  function openCreate() {
    setEditingId(null);
    setForm({ name: "", description: "", active: true });
    setFormErrors({});
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(item) {
    setEditingId(item.id);
    setForm(skillToForm(item));
    setFormErrors({});
    setFormError("");
    setFormOpen(true);
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

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    const errors = validateSkill(form);
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      setFormError("Please correct the highlighted fields and try again.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const payload = skillFormToPayload(form);
      if (editingId === null) {
        await createSkill(payload);
        showFlash("success", `“${payload.name}” was created.`);
      } else {
        await updateSkill(editingId, payload);
        showFlash("success", `“${payload.name}” was updated.`);
      }
      setFormOpen(false);
      reload();
    } catch (error) {
      if (error && error.fields && Object.keys(error.fields).length) {
        setFormErrors(error.fields);
      }
      setFormError(error instanceof Error ? error.message : "The skill could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmStatusChange() {
    if (!statusTarget || statusBusy) return;
    setStatusBusy(true);
    try {
      await setSkillActive(statusTarget.id, !statusTarget.active);
      setItems((previous) =>
        previous.map((entry) =>
          entry.id === statusTarget.id ? { ...entry, active: !statusTarget.active } : entry,
        ),
      );
      showFlash(
        "success",
        `“${statusTarget.name}” is now ${statusTarget.active ? "inactive" : "active"}.`,
      );
      setStatusTarget(null);
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "The skill status could not be changed.");
      setStatusTarget(null);
    } finally {
      setStatusBusy(false);
    }
  }

  return (
    <div className="cmSkillsPanel">
      <SectionHead
        title="Skills"
        description="The capability and certification vocabulary used by recruitment, workers and deployments. There is no delete — deactivating just hides a skill from new selections."
      />

      <FlashBanner flash={flash} />

      <div className="cmToolbar cmToolbarNowrap">
        <label className="cmSearchBox">
          <Search size={15} />
          <input
            type="search"
            placeholder="Search skills…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search skills"
          />
        </label>
        <div className="cmToolbarControls">
          <span className="cmCount">{filtered.length} of {items.length}</span>
          <button type="button" className="primaryButton cmBtn cmPageBtn" onClick={openCreate}>
            <Plus size={14} /> New skill
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading skills…" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={items.length ? "No skills match your search" : "No skills yet"}
          message={items.length ? "Try a different search term." : "Create your first skill, then associate it with a manpower category."}
        />
      ) : (
        <div className="cmTableWrap">
          <table className="cmTable">
            <thead>
              <tr>
                <th>Skill</th>
                <th>Description</th>
                <th className="cmColCenter">Status</th>
                <th className="cmColActions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="cmEntity">
                      <span className="cmIconTile"><Wrench size={17} /></span>
                      <strong>{item.name}</strong>
                    </div>
                  </td>
                  <td className="cmMuted cmCellWrap">{item.description || "—"}</td>
                  <td className="cmColCenter"><SkillStatus active={item.active} /></td>
                  <td className="cmColActions">
                    <div className="cmRowActions">
                      <button type="button" className="cmIconButton" aria-label={`Edit ${item.name}`} onClick={() => openEdit(item)}>
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="cmIconButton"
                        aria-label={`${item.active ? "Deactivate" : "Activate"} ${item.name}`}
                        onClick={() => setStatusTarget(item)}
                      >
                        {item.active ? <CirclePause size={15} /> : <CirclePlay size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <Modal
          title={editingId === null ? "New skill" : "Edit skill"}
          description="Skills are reusable across manpower categories and worker records."
          onClose={() => { if (!saving) setFormOpen(false); }}
          footer={(
            <>
              <button type="button" className="secondaryButton cmBtn" onClick={() => setFormOpen(false)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" form="skill-form" className="primaryButton cmBtn" disabled={saving}>
                {saving ? "Saving…" : editingId === null ? "Create skill" : "Save changes"}
              </button>
            </>
          )}
        >
          <form id="skill-form" className="cmForm" onSubmit={handleSubmit} noValidate>
            {formError && <p className="actionError" role="alert">{formError}</p>}
            <div className="cmFormGrid">
              <Field label="Skill name" htmlFor="skill-name" required error={formErrors.name}>
                <input
                  id="skill-name"
                  value={form.name}
                  maxLength={120}
                  placeholder="e.g. PSARA Trained"
                  onChange={(event) => updateForm("name", event.target.value)}
                />
              </Field>
              <Field label="Description" htmlFor="skill-description" error={formErrors.description} hint="Optional — what this skill or certification covers">
                <textarea
                  id="skill-description"
                  value={form.description}
                  maxLength={500}
                  rows={3}
                  placeholder="Short description"
                  onChange={(event) => updateForm("description", event.target.value)}
                />
              </Field>
              <div className="cmSwitchRow">
                <Switch
                  id="skill-active"
                  checked={form.active}
                  onChange={(value) => updateForm("active", value)}
                  label={form.active ? "Active — available for new selections" : "Inactive — hidden from new selections"}
                />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {statusTarget && (
        <ConfirmDialog
          title={statusTarget.active ? "Deactivate skill" : "Activate skill"}
          message={
            statusTarget.active
              ? `Deactivate “${statusTarget.name}”? It will no longer appear in new selections, but existing worker records are kept.`
              : `Activate “${statusTarget.name}”? It will again be available for new selections.`
          }
          confirmLabel={statusTarget.active ? "Deactivate" : "Activate"}
          busy={statusBusy}
          onConfirm={confirmStatusChange}
          onCancel={() => { if (!statusBusy) setStatusTarget(null); }}
        />
      )}
    </div>
  );
}