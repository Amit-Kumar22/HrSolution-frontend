"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, ImagePlus, Loader2, RefreshCw, Save, Settings2, UploadCloud } from "lucide-react";
import {
  getCompanySettings,
  updateCompanySettings,
  uploadCompanyLogo,
  validateImageFile,
} from "../../lib/adminApi";
import { hasPermission } from "../../lib/auth";
import { resolvePublicFileUrl } from "../../lib/publicApi";
import {
  COMPANY_PROFILE_GROUPS,
  companyFormToPayload,
  companySettingsToForm,
  EMPTY_COMPANY_FORM,
  validateCompanyForm,
} from "../../lib/company-settings-forms";
import {
  Chip,
  EmptyState,
  ErrorState,
  Field,
  FlashBanner,
  LoadingState,
  Notice,
  SectionHead,
  formatDateTime,
  useFlash,
} from "../admin/admin-ui";

const TABS = [
  { key: "profile", label: "Company profile", icon: Building2 },
  { key: "logo", label: "Company logo", icon: ImagePlus },
  { key: "system", label: "System configuration", icon: Settings2 },
];

/** Splits a group's fields into form rows: two per row, but a full-width field on its own. */
function toRows(fields) {
  const rows = [];
  let buffer = [];
  const flush = () => {
    if (buffer.length) {
      rows.push({ type: "pair", fields: buffer });
      buffer = [];
    }
  };
  for (const field of fields) {
    if (field.full) {
      flush();
      rows.push({ type: "single", field });
    } else {
      buffer.push(field);
      if (buffer.length === 2) flush();
    }
  }
  flush();
  return rows;
}

export default function SettingsPanel({ session }) {
  const canEdit = hasPermission(session, "SETTINGS_MANAGE");

  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(EMPTY_COMPANY_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [tab, setTab] = useState("profile");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [flash, showFlash] = useFlash();

  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const logoPreviewRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getCompanySettings();
        if (cancelled) return;
        setSettings(data);
        setForm(companySettingsToForm(data));
        setLoadError("");
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "The company profile could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  useEffect(
    () => () => {
      if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
    },
    [],
  );

  function setField(name, value) {
    setForm((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => (previous[name] ? { ...previous, [name]: undefined } : previous));
  }

  function resetForm() {
    setForm(settings ? companySettingsToForm(settings) : EMPTY_COMPANY_FORM);
    setErrors({});
    setSaveError("");
  }

  async function handleSave(event) {
    event.preventDefault();
    if (saving || !canEdit) return;
    setSaveError("");
    const nextErrors = validateCompanyForm(form);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      showFlash("error", "Please correct the highlighted fields before saving.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateCompanySettings(companyFormToPayload(form));
      setSettings(updated);
      setForm(companySettingsToForm(updated));
      setErrors({});
      showFlash("success", "Company profile saved.");
    } catch (error) {
      if (error && error.fields && Object.keys(error.fields).length) {
        setErrors(error.fields);
      }
      setSaveError(error instanceof Error ? error.message : "The company profile could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function performLogoUpload(file) {
    setLogoBusy(true);
    setLogoError("");
    try {
      const updated = await uploadCompanyLogo(file);
      setSettings(updated);
      if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
      logoPreviewRef.current = null;
      setLogoPreview("");
      showFlash("success", "Company logo updated.");
    } catch (error) {
      setLogoError(error instanceof Error ? error.message : "The logo could not be uploaded.");
    } finally {
      setLogoBusy(false);
    }
  }

  function handleLogoSelect(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setLogoError(validationError);
      return;
    }
    if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
    const objectUrl = URL.createObjectURL(file);
    logoPreviewRef.current = objectUrl;
    setLogoPreview(objectUrl);
    setLogoError("");
    performLogoUpload(file);
  }

  const logoUrl = logoPreview || resolvePublicFileUrl(settings && settings.logoPath);

  function renderField(field) {
    const id = `cs-${field.name}`;
    const value = form[field.name];
    const disabled = !canEdit || saving;
    const control =
      field.type === "textarea" ? (
        <textarea
          id={id}
          value={value}
          onChange={(event) => setField(field.name, event.target.value)}
          maxLength={field.maxLength}
          rows={5}
          disabled={disabled}
        />
      ) : (
        <input
          id={id}
          type={field.email ? "email" : "text"}
          value={value}
          onChange={(event) => setField(field.name, event.target.value)}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          autoComplete="off"
          disabled={disabled}
        />
      );
    return (
      <Field
        key={field.name}
        label={field.label}
        htmlFor={id}
        required={field.required}
        error={errors[field.name]}
        hint={field.hint}
      >
        {control}
      </Field>
    );
  }

  return (
    <div className="saSettingsPanel">
      <SectionHead
        title="Settings"
        description="The company profile every part of the platform reads from — the website header and footer, invoices, payslips and emails."
      />

      <FlashBanner flash={flash} />

      <div className="cmToolbar cmToolbarNowrap">
        <div className="saTabBar">
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className={`secondaryButton cmBtn${tab === item.key ? " primaryButton" : ""}`}
                onClick={() => setTab(item.key)}
              >
                <Icon size={14} /> {item.label}
              </button>
            );
          })}
        </div>
        {settings ? (
          <Chip tone="neutral">
            Updated {formatDateTime(settings.updatedAt)}
            {settings.updatedBy ? ` · ${settings.updatedBy}` : ""}
          </Chip>
        ) : null}
      </div>

      {loading ? (
        <LoadingState label="Loading company profile…" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : (
        <>
          {!canEdit && (
            <Notice tone="warn">
              You have read-only access. Editing the company profile requires the SETTINGS_MANAGE permission, which is
              held by the Super Admin role.
            </Notice>
          )}

          {tab === "profile" && (
            <form className="cmForm cmFormGrid" onSubmit={handleSave}>
              {saveError && <Notice tone="error">{saveError}</Notice>}

              {COMPANY_PROFILE_GROUPS.map((group) => (
                <div className="saPermGroup" key={group.key}>
                  <div className="saPermGroupHead">
                    <div>
                      <strong>{group.title}</strong>
                      <p>{group.description}</p>
                    </div>
                  </div>
                  <div className="saSettingsGroupBody">
                    {toRows(group.fields).map((row, index) =>
                      row.type === "single" ? (
                        <div key={`${group.key}-single-${index}`}>{renderField(row.field)}</div>
                      ) : (
                        <div className="cmFormRow" key={`${group.key}-row-${index}`}>
                          {row.fields.map((field) => renderField(field))}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ))}

              <Notice tone="info">
                Saving sends every field: the profile is replaced as a whole, so anything left blank is cleared. The
                logo is managed on its own tab and is never affected by a profile save.
              </Notice>

              <div className="cmModalFooter">
                <button
                  type="button"
                  className="secondaryButton cmBtn"
                  onClick={resetForm}
                  disabled={saving}
                >
                  <RefreshCw size={15} /> Revert changes
                </button>
                <button type="submit" className="primaryButton cmBtn" disabled={saving || !canEdit}>
                  {saving ? (
                    <>
                      <Loader2 size={15} className="spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <Save size={15} /> Save profile
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {tab === "logo" && (
            <div className="saSettingsGroupBody" style={{ border: "1px solid #e6ecf4", borderRadius: 10, background: "#fff", maxWidth: 560 }}>
              <div className="cmHeroBlock">
                <span className="cmFieldLabel">Company logo</span>
                <div className="cmHeroRow">
                  <div className="saLogoPreview">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Company logo" />
                    ) : (
                      <span className="cmHeroPlaceholder">
                        <ImagePlus size={20} /> No logo
                      </span>
                    )}
                  </div>
                  <div className="cmHeroControls">
                    <label className="secondaryButton cmBtn cmFileButton">
                      <UploadCloud size={15} />
                      {logoBusy ? "Uploading…" : logoUrl ? "Replace logo" : "Choose logo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif"
                        onChange={handleLogoSelect}
                        disabled={logoBusy || !canEdit}
                        hidden
                      />
                    </label>
                    <small className="cmHint">PNG, JPEG or GIF · up to 2 MB. Uploaded immediately.</small>
                  </div>
                </div>
                {logoError && (
                  <small className="cmFieldError" role="alert">
                    {logoError}
                  </small>
                )}
              </div>

              <Notice tone="info">
                The logo is served publicly and appears on the website header. It is stored separately from the profile,
                so saving the profile form never clears it.
              </Notice>
            </div>
          )}

          {tab === "system" && (
            <EmptyState
              icon={Settings2}
              title="System configuration is not available yet"
              message="No system configuration API is exposed by the backend. Company profile settings are live above; number series, statutory configuration and other system-level settings will appear here once the corresponding endpoints are added."
            />
          )}
        </>
      )}
    </div>
  );
}
