"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { listPermissions, listRoles, updateRolePermissions } from "../../lib/adminApi";
import {
  Chip,
  EmptyState,
  ErrorState,
  FlashBanner,
  LoadingState,
  Notice,
  SectionHead,
  useFlash,
} from "../admin/admin-ui";
import { roleDescription, roleLabel } from "./account-meta";

function groupPermissions(permissions) {
  const groups = new Map();
  for (const permission of permissions) {
    const moduleName = permission.module || "OTHER";
    if (!groups.has(moduleName)) groups.set(moduleName, []);
    groups.get(moduleName).push(permission);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([moduleName, items]) => ({
      module: moduleName,
      items: [...items].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

export default function RolesPanel() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [flash, showFlash] = useFlash();

  const [activeRoleName, setActiveRoleName] = useState("");
  const [draftState, setDraftState] = useState({ role: null, values: [] });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [roleList, permissionList] = await Promise.all([listRoles(), listPermissions()]);
        if (cancelled) return;
        setRoles(roleList);
        setPermissions(permissionList);
        setLoadError("");
        setActiveRoleName((current) => current || (roleList[0] ? roleList[0].name : ""));
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Roles could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const activeRole = useMemo(() => roles.find((role) => role.name === activeRoleName) || null, [roles, activeRoleName]);

  const draft = useMemo(() => {
    if (!activeRole) return [];
    if (draftState.role === activeRole.name) return draftState.values;
    return Array.isArray(activeRole.permissions) ? [...activeRole.permissions] : [];
  }, [activeRole, draftState]);

  const grouped = useMemo(() => groupPermissions(permissions), [permissions]);
  const isSuperAdmin = activeRoleName === "SUPER_ADMIN";
  const dirty = useMemo(() => {
    if (!activeRole) return false;
    const current = [...(activeRole.permissions || [])].sort();
    const next = [...draft].sort();
    return current.length !== next.length || current.some((value, index) => value !== next[index]);
  }, [activeRole, draft]);

  function togglePermission(name) {
    if (isSuperAdmin || !activeRole) return;
    setDraftState({
      role: activeRole.name,
      values: draft.includes(name) ? draft.filter((p) => p !== name) : [...draft, name],
    });
  }

  function resetDraft() {
    if (activeRole) {
      setDraftState({
        role: activeRole.name,
        values: Array.isArray(activeRole.permissions) ? [...activeRole.permissions] : [],
      });
    }
    setSaveError("");
  }

  async function save(event) {
    event.preventDefault();
    if (!activeRole || saving || isSuperAdmin) return;
    setSaveError("");
    setSaving(true);
    try {
      await updateRolePermissions(activeRole.id, draft);
      showFlash("success", `${roleLabel(activeRole.name)} permissions updated.`);
      setReloadToken((token) => token + 1);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The permissions could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SectionHead
        title="Roles & permissions"
        description="Roles decide which dashboard a user reaches and which modules they can use. Grant only the permissions each role needs."
      />

      <FlashBanner flash={flash} />

      {loading ? (
        <LoadingState label="Loading roles…" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => setReloadToken((t) => t + 1)} />
      ) : !roles.length ? (
        <EmptyState title="No roles found" message="The backend did not return any roles." />
      ) : (
        <>
          <div className="cmToolbar">
            <label className="cmSelect">
              Role
              <select
                value={activeRoleName}
                onChange={(event) => setActiveRoleName(event.target.value)}
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.name}>
                    {roleLabel(role.name)}
                  </option>
                ))}
              </select>
            </label>
            <span className="cmCount">
              {draft.length} of {permissions.length} permissions granted
            </span>
          </div>

          {activeRole && (
            <div className="saPermGroups">
              <div className="saInlineNote">
                <strong>{roleLabel(activeRole.name)}</strong>
                {activeRole.systemRole ? " · system role" : ""}
                <br />
                {roleDescription(activeRole.name)}
              </div>

              {isSuperAdmin ? (
                <Notice tone="warn">
                  The Super Admin role always holds every permission and cannot be edited. This keeps a way to repair
                  the other roles if they are ever misconfigured.
                </Notice>
              ) : null}

              {saveError && <Notice tone="error">{saveError}</Notice>}

              <form className="cmForm cmFormGrid" onSubmit={save}>
                {grouped.map((group) => (
                  <div className="saPermGroup" key={group.module}>
                    <div className="saPermGroupHead">
                      <strong>{group.module}</strong>
                      <span className="cmCount">{group.items.length} permission(s)</span>
                    </div>
                    <div className="saPermGroupList">
                      {group.items.map((permission) => {
                        const checked = draft.includes(permission.name);
                        return (
                          <label
                            key={permission.name}
                            className="saPermItem"
                            title={permission.description || permission.name}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePermission(permission.name)}
                              disabled={isSuperAdmin || saving}
                            />
                            <span>
                              <strong>{permission.name}</strong>
                              {permission.description && <small>{permission.description}</small>}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {!isSuperAdmin && (
                  <div className="cmModalFooter">
                    <Chip tone={dirty ? "warn" : "neutral"}>{dirty ? "Unsaved changes" : "Saved"}</Chip>
                    <button
                      type="button"
                      className="secondaryButton cmBtn"
                      onClick={resetDraft}
                      disabled={saving || !dirty}
                    >
                      Reset
                    </button>
                    <button type="submit" className="primaryButton cmBtn" disabled={saving || !dirty}>
                      {saving ? (
                        <>
                          <Loader2 size={15} className="spin" /> Saving…
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={15} /> Save permissions
                        </>
                      )}
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}
