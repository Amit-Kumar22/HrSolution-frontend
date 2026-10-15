"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CirclePause, CirclePlay, ListChecks, Pencil, Plus, Search, Tags } from "lucide-react";
import {
  activateManpowerCategory,
  createManpowerCategory,
  deactivateManpowerCategory,
  listManpowerCategories,
  listManpowerCategorySkills,
  listSkills,
  replaceManpowerCategorySkills,
  updateManpowerCategory,
} from "@/lib/adminApi";
import {
  categoryFormToPayload,
  categoryToForm,
  EMPTY_CATEGORY_FORM,
  skillLevelLabel,
  SKILL_LEVELS,
  SKILL_LEVEL_TONES,
  validateCategory,
} from "@/lib/manpower-forms";
import {
  Chip,
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

function CategoryStatus({ active }) {
  return (
    <span className={`cmStatus ${active ? "cmStatusPublished" : "cmStatusDraft"}`}>
      <i />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function ManpowerCategoriesPanel() {
  const [items, setItems] = useState([]);
  const [skillCounts, setSkillCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [flash, showFlash] = useFlash();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_CATEGORY_FORM });
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [statusTarget, setStatusTarget] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const [skillsTarget, setSkillsTarget] = useState(null);
  const [skillsBusy, setSkillsBusy] = useState(false);
  const [skillsError, setSkillsError] = useState("");
  const [allSkills, setAllSkills] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [skillsSaving, setSkillsSaving] = useState(false);

  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listManpowerCategories();
        if (cancelled) return;
        setItems(data);
        setLoadError("");
        setLoading(false);
        const counts = {};
        for (const category of data) {
          try {
            const skills = await listManpowerCategorySkills(category.id);
            counts[category.id] = skills.length;
          } catch {
            counts[category.id] = null;
          }
        }
        if (!cancelled) setSkillCounts(counts);
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Categories could not be loaded.");
        setLoading(false);
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
    const sorted = [...items].sort((a, b) => {
      const orderDiff = (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0);
      return orderDiff || String(a.name || "").localeCompare(String(b.name || ""));
    });
    if (!query) return sorted;
    return sorted.filter((item) =>
      [item.code, item.name, skillLevelLabel(item.skillLevelLabel || item.skillLevel), item.description].some(
        (value) => String(value || "").toLowerCase().includes(query),
      ),
    );
  }, [items, search]);

  function openCreate() {
    const nextOrder = items.reduce((max, item) => Math.max(max, Number(item.displayOrder) || 0), 0) + 10;
    setEditingId(null);
    setForm({ ...EMPTY_CATEGORY_FORM, displayOrder: nextOrder });
    setFormErrors({});
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(item) {
    setEditingId(item.id);
    setForm(categoryToForm(item));
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

    const errors = validateCategory(form);
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      setFormError("Please correct the highlighted fields and try again.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const payload = categoryFormToPayload(form);
      if (editingId === null) {
        await createManpowerCategory(payload);
        showFlash("success", `“${payload.name}” was created.`);
      } else {
        await updateManpowerCategory(editingId, payload);
        showFlash("success", `“${payload.name}” was updated.`);
      }
      setFormOpen(false);
      reload();
    } catch (error) {
      if (error && error.fields && Object.keys(error.fields).length) {
        setFormErrors(error.fields);
      }
      setFormError(error instanceof Error ? error.message : "The category could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmStatusChange() {
    if (!statusTarget || statusBusy) return;
    setStatusBusy(true);
    try {
      if (statusTarget.active) {
        await deactivateManpowerCategory(statusTarget.id);
        showFlash("success", `“${statusTarget.name}” was deactivated.`);
      } else {
        await activateManpowerCategory(statusTarget.id);
        showFlash("success", `“${statusTarget.name}” was activated.`);
      }
      setItems((previous) =>
        previous.map((entry) =>
          entry.id === statusTarget.id ? { ...entry, active: !statusTarget.active } : entry,
        ),
      );
      setStatusTarget(null);
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "The category status could not be changed.");
      setStatusTarget(null);
    } finally {
      setStatusBusy(false);
    }
  }

  async function openSkills(category) {
    setSkillsTarget(category);
    setSkillsBusy(true);
    setSkillsError("");
    try {
      const [skills, assigned] = await Promise.all([
        listSkills({ includeInactive: true }),
        listManpowerCategorySkills(category.id),
      ]);
      setAllSkills(skills);
      setSelectedIds(new Set(assigned.map((skill) => skill.id)));
    } catch (error) {
      setSkillsError(error instanceof Error ? error.message : "Skills could not be loaded.");
    } finally {
      setSkillsBusy(false);
    }
  }

  function closeSkills() {
    if (skillsSaving) return;
    setSkillsTarget(null);
  }

  function toggleSkill(id) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveSkills() {
    if (!skillsTarget || skillsSaving || skillsBusy) return;
    setSkillsSaving(true);
    setSkillsError("");
    try {
      const ids = [...selectedIds];
      await replaceManpowerCategorySkills(skillsTarget.id, ids);
      setSkillCounts((previous) => ({ ...previous, [skillsTarget.id]: ids.length }));
      showFlash("success", `Skills updated for “${skillsTarget.name}”.`);
      setSkillsTarget(null);
    } catch (error) {
      setSkillsError(error instanceof Error ? error.message : "Skills could not be updated.");
    } finally {
      setSkillsSaving(false);
    }
  }

  return (
    <div className="cmCategoriesPanel">
      <SectionHead
        title="Manpower categories"
        description="Kinds of workers the company supplies. The skill level selects which state minimum wage applies. Deactivating hides a category from new dropdowns only."
      />

      <FlashBanner flash={flash} />

      <div className="cmToolbar cmToolbarNowrap">
        <label className="cmSearchBox">
          <Search size={15} />
          <input
            type="search"
            placeholder="Search categories…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search categories"
          />
        </label>
        <div className="cmToolbarControls">
          <span className="cmCount">{filtered.length} of {items.length}</span>
          <button type="button" className="primaryButton cmBtn cmPageBtn" onClick={openCreate}>
            <Plus size={14} /> New category
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading categories…" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Tags}
          title={items.length ? "No categories match your search" : "No categories yet"}
          message={items.length ? "Try a different search term." : "Create your first category to show it here and use it in enquiries and requisitions."}
        />
      ) : (
        <div className="cmTableWrap">
          <table className="cmTable">
            <thead>
              <tr>
                <th>Category</th>
                <th>Skill level</th>
                <th>Description</th>
                <th className="cmColCenter">Skills</th>
                <th className="cmColCenter">Order</th>
                <th className="cmColCenter">Status</th>
                <th className="cmColActions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="cmEntity">
                      <span className="cmIconTile"><Tags size={17} /></span>
                      <div>
                        <strong>{item.name}</strong>
                        <small className="cmMuted cmBlock"><code className="cmCode">{item.code}</code></small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Chip tone={SKILL_LEVEL_TONES[item.skillLevel] || "neutral"}>
                      {skillLevelLabel(item.skillLevelLabel || item.skillLevel)}
                    </Chip>
                  </td>
                  <td className="cmMuted cmCellWrap">{item.description || "—"}</td>
                  <td className="cmColCenter">
                    <button
                      type="button"
                      className="cmLinkButton"
                      onClick={() => openSkills(item)}
                      disabled={skillsBusy || loading}
                    >
                      {skillCounts[item.id] == null ? "…" : skillCounts[item.id]}
                    </button>
                  </td>
                  <td className="cmColCenter">{item.displayOrder ?? 0}</td>
                  <td className="cmColCenter"><CategoryStatus active={item.active} /></td>
                  <td className="cmColActions">
                    <div className="cmRowActions">
                      <button type="button" className="cmIconButton" aria-label={`Edit ${item.name}`} onClick={() => openEdit(item)}>
                        <Pencil size={15} />
                      </button>
                      <button type="button" className="cmIconButton" aria-label={`Manage skills for ${item.name}`} onClick={() => openSkills(item)}>
                        <ListChecks size={15} />
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
          title={editingId === null ? "New category" : "Edit category"}
          description="The code is a stable identifier used by imports and exports, so it cannot be changed after creation. The skill level selects the minimum wage band."
          onClose={() => { if (!saving) setFormOpen(false); }}
          footer={(
            <>
              <button type="button" className="secondaryButton cmBtn" onClick={() => setFormOpen(false)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" form="category-form" className="primaryButton cmBtn" disabled={saving}>
                {saving ? "Saving…" : editingId === null ? "Create category" : "Save changes"}
              </button>
            </>
          )}
        >
          <form id="category-form" className="cmForm" onSubmit={handleSubmit} noValidate>
            {formError && <p className="actionError" role="alert">{formError}</p>}
            <div className="cmFormGrid">
              <Field
                label="Code"
                htmlFor="category-code"
                required
                error={formErrors.code}
                hint={editingId === null ? "Uppercase letters, numbers and underscores, e.g. SECURITY_GUARD" : "Fixed identifier — it cannot be changed on edit."}
              >
                <input
                  id="category-code"
                  value={form.code}
                  maxLength={40}
                  placeholder="SECURITY_GUARD"
                  disabled={editingId !== null}
                  onChange={(event) => updateForm("code", event.target.value.toUpperCase())}
                />
              </Field>
              <Field label="Name" htmlFor="category-name" required error={formErrors.name}>
                <input
                  id="category-name"
                  value={form.name}
                  maxLength={120}
                  placeholder="e.g. Security Guard"
                  onChange={(event) => updateForm("name", event.target.value)}
                />
              </Field>
              <Field
                label="Skill level"
                htmlFor="category-level"
                required
                error={formErrors.skillLevel}
                hint="Determines the applicable state minimum wage — a payroll decision."
              >
                <select
                  id="category-level"
                  value={form.skillLevel}
                  onChange={(event) => updateForm("skillLevel", event.target.value)}
                >
                  {SKILL_LEVELS.map((level) => (
                    <option key={level} value={level}>{skillLevelLabel(level)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Description" htmlFor="category-description" error={formErrors.description}>
                <textarea
                  id="category-description"
                  value={form.description}
                  maxLength={500}
                  rows={3}
                  placeholder="What this category covers"
                  onChange={(event) => updateForm("description", event.target.value)}
                />
              </Field>
              <Field label="Display order" htmlFor="category-order" error={formErrors.displayOrder} hint="Lower numbers appear first">
                <input
                  id="category-order"
                  type="number"
                  value={form.displayOrder}
                  placeholder="10"
                  onChange={(event) => updateForm("displayOrder", event.target.value)}
                />
              </Field>
              <div className="cmSwitchRow">
                <Switch
                  id="category-active"
                  checked={form.active}
                  onChange={(value) => updateForm("active", value)}
                  label={form.active ? "Active — shown in new enquiries and dropdowns" : "Inactive — hidden from new dropdowns"}
                />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {statusTarget && (
        <ConfirmDialog
          title={statusTarget.active ? "Deactivate category" : "Activate category"}
          message={
            statusTarget.active
              ? `Deactivate “${statusTarget.name}”? Existing history stays valid; it is only hidden from new dropdowns.`
              : `Activate “${statusTarget.name}”? It will again appear in new enquiries and dropdowns.`
          }
          confirmLabel={statusTarget.active ? "Deactivate" : "Activate"}
          busy={statusBusy}
          onConfirm={confirmStatusChange}
          onCancel={() => { if (!statusBusy) setStatusTarget(null); }}
        />
      )}

      {skillsTarget && (
        <Modal
          title={`Skills for ${skillsTarget.name}`}
          description={`${selectedIds.size} of ${allSkills.length} selected. Saving replaces the category’s current skill set.`}
          onClose={closeSkills}
          footer={(
            <>
              <button type="button" className="secondaryButton cmBtn" onClick={closeSkills} disabled={skillsSaving}>
                Cancel
              </button>
              <button
                type="button"
                className="secondaryButton cmBtn"
                onClick={() => setSelectedIds(new Set())}
                disabled={skillsSaving || skillsBusy || selectedIds.size === 0}
              >
                Clear all
              </button>
              <button
                type="button"
                className="primaryButton cmBtn"
                onClick={saveSkills}
                disabled={skillsSaving || skillsBusy}
              >
                {skillsSaving ? "Saving…" : "Save skills"}
              </button>
            </>
          )}
        >
          {skillsBusy ? (
            <LoadingState label="Loading skills…" />
          ) : skillsError ? (
            <ErrorState message={skillsError} onRetry={() => openSkills(skillsTarget)} />
          ) : allSkills.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="No skills defined"
              message="Create skills in the Skills module first, then associate them with this category."
            />
          ) : (
            <>
              {skillsError && <p className="actionError" role="alert">{skillsError}</p>}
              <div className="cmCheckList">
                {allSkills.map((skill) => {
                  const checked = selectedIds.has(skill.id);
                  return (
                    <label key={skill.id} className={`cmCheckItem${checked ? " cmCheckChecked" : ""}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleSkill(skill.id)} />
                      <span className="cmCheckBox" aria-hidden="true" />
                      <span className="cmCheckText">
                        <strong>{skill.name}</strong>
                        {skill.description && <small>{skill.description}</small>}
                      </span>
                      {!skill.active && (
                        <span className="cmStatus cmStatusDraft"><i />Inactive</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}