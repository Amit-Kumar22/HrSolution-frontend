"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UsersRound,
} from "lucide-react";
import {
  CANDIDATE_SOURCES,
  candidateSourceLabel,
  deleteCandidate,
  listCandidates,
  listManpowerCategories,
  setCandidateSpam,
  uploadCandidateResume,
  validateResumeFile,
} from "../../lib/adminApi";
import { rolesOf } from "../../lib/auth";
import {
  Chip,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FlashBanner,
  LoadingState,
  SectionHead,
  Switch,
  formatDateTime,
  useFlash,
} from "./admin-ui";
import { CandidateDetailModal, CandidateFormModal } from "./candidate-modals";

const SOURCE_TONE = {
  WEBSITE: "info",
  REFERRAL: "accent",
  WALK_IN: "success",
  AGENCY: "neutral",
  CAMPUS: "warn",
  OTHER: "neutral",
};

const SORT_OPTIONS = [
  { value: "createdAt,DESC", label: "Newest first" },
  { value: "createdAt,ASC", label: "Oldest first" },
  { value: "fullName,ASC", label: "Name A–Z" },
  { value: "fullName,DESC", label: "Name Z–A" },
  { value: "applicationCount,DESC", label: "Most applications" },
  { value: "applicationCount,ASC", label: "Fewest applications" },
];

const PAGE_SIZES = [10, 20, 50, 100];

const LOGIN_OPTIONS = [
  { value: "", label: "All candidates" },
  { value: "true", label: "Registered (has login)" },
  { value: "false", label: "Guests (no login)" },
];

export function candidateCapabilities(session) {
  let roles = [];
  try {
    roles = rolesOf(session);
  } catch {
    roles = [];
  }
  const set = new Set(roles);
  const isSuper = set.has("SUPER_ADMIN");
  const isAdmin = set.has("ADMIN") || set.has("MANAGER");
  const isHr = ["HR", "HR_MANAGER", "HR_RECRUITER", "RECRUITER"].some((role) => set.has(role));
  const manage = isSuper || isAdmin || isHr;
  return {
    canView: true,
    canCreate: manage,
    canEdit: manage,
    canUploadResume: manage,
    canSpam: manage,
    canDelete: manage,
    canViewNotes: manage,
  };
}

function SourceChip({ source }) {
  if (!source) return <span className="cmMuted">—</span>;
  return <Chip tone={SOURCE_TONE[source] || "neutral"}>{candidateSourceLabel(source)}</Chip>;
}

export default function CandidatesPanel({ session, capabilities }) {
  const caps = useMemo(
    () => capabilities || candidateCapabilities(session),
    [capabilities, session],
  );

  const [pageData, setPageData] = useState({
    content: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [flash, showFlash] = useFlash();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [loginFilter, setLoginFilter] = useState("");
  const [includeSpam, setIncludeSpam] = useState(false);
  const [sortValue, setSortValue] = useState("createdAt,DESC");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [reloadToken, setReloadToken] = useState(0);

  const [categories, setCategories] = useState([]);

  const [formState, setFormState] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [detailVersion, setDetailVersion] = useState(0);
  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const resumeInputRef = useRef(null);
  const resumeTargetRef = useRef(null);
  const [resumeBusy, setResumeBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const categoryList = await listManpowerCategories();
        if (!cancelled) setCategories(categoryList);
      } catch {
        // Category filter is optional; the list still works without it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listCandidates({
          search: search || undefined,
          preferredCategoryId: categoryFilter || undefined,
          source: sourceFilter || undefined,
          hasLogin: loginFilter || undefined,
          includeSpam,
          page,
          size,
          sort: [sortValue],
        });
        if (cancelled) return;
        setPageData(data);
        setLoadError("");
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Candidates could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search, categoryFilter, sourceFilter, loginFilter, includeSpam, sortValue, page, size, reloadToken]);

  function reload() {
    setLoading(true);
    setReloadToken((token) => token + 1);
  }

  function clearFilters() {
    setSearchInput("");
    setCategoryFilter("");
    setSourceFilter("");
    setLoginFilter("");
    setPage(0);
  }

  function openCreate() {
    setFormState({ mode: "create", candidateId: null });
  }

  function openEdit(candidate) {
    setFormState({ mode: "edit", candidateId: candidate.id });
  }

  function handleSaved(saved, isEdit) {
    setFormState(null);
    showFlash("success", isEdit ? "Candidate updated." : "Candidate added.");
    reload();
    if (detailId && saved && saved.id === detailId) {
      setDetailVersion((value) => value + 1);
    }
  }

  async function runConfirm() {
    if (!confirm || confirmBusy) return;
    setConfirmBusy(true);
    try {
      if (confirm.type === "delete") {
        await deleteCandidate(confirm.candidate.id);
        showFlash("success", "Candidate deleted.");
        if (detailId === confirm.candidate.id) setDetailId(null);
        const lastItemOnPage = pageData.content.length === 1 && page > 0;
        if (lastItemOnPage) setPage((current) => current - 1);
        else reload();
      } else {
        const spam = confirm.type === "spam";
        await setCandidateSpam(confirm.candidate.id, spam);
        showFlash("success", spam ? "Candidate flagged as spam." : "Spam flag cleared.");
        reload();
        if (detailId === confirm.candidate.id) setDetailVersion((value) => value + 1);
      }
      setConfirm(null);
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "The action could not be completed.");
      setConfirm(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  function pickResume(candidate) {
    if (!caps.canUploadResume) return;
    resumeTargetRef.current = candidate;
    if (resumeInputRef.current) resumeInputRef.current.value = "";
    resumeInputRef.current?.click();
  }

  async function onResumePicked(event) {
    const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    const target = resumeTargetRef.current;
    if (resumeInputRef.current) resumeInputRef.current.value = "";
    if (!file || !target) return;
    const validationError = validateResumeFile(file);
    if (validationError) {
      showFlash("error", validationError);
      resumeTargetRef.current = null;
      return;
    }
    setResumeBusy(true);
    try {
      await uploadCandidateResume(target.id, file);
      showFlash("success", `Resume uploaded for ${target.fullName || `candidate #${target.id}`}.`);
      reload();
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "The resume could not be uploaded.");
    } finally {
      setResumeBusy(false);
      resumeTargetRef.current = null;
    }
  }

  const totalPages = pageData.totalPages || 0;
  const current = Math.min(page + 1, Math.max(totalPages, 1));
  const hasFilters = Boolean(searchInput || categoryFilter || sourceFilter || loginFilter);

  return (
    <div>
      <SectionHead
        title="Candidates"
        description="Everyone in the hiring pipeline — website applicants, referrals, walk-ins and agency candidates. Spam-flagged profiles stay hidden until you include them."
        action={
          caps.canCreate ? (
            <button type="button" className="primaryButton cmBtn" onClick={openCreate}>
              <Plus size={16} /> Add candidate
            </button>
          ) : null
        }
      />

      <FlashBanner flash={flash} />

      <div className="cmToolbar">
        <label className="cmSearchBox">
          <Search size={16} />
          <input
            type="search"
            value={searchInput}
            placeholder="Search name, email, phone or city"
            aria-label="Search candidates"
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>
        <div className="cmToolbarControls">
          <span className="cmCount">
            {pageData.totalElements} candidate{pageData.totalElements === 1 ? "" : "s"}
          </span>
          <label className="cmSelect">
            <span>Sort</span>
            <select value={sortValue} onChange={(event) => { setSortValue(event.target.value); setPage(0); }}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="cmSelect">
            <span>Per page</span>
            <select value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(0); }}>
              {PAGE_SIZES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <Switch
            id="candidate-include-spam"
            checked={includeSpam}
            onChange={(next) => { setIncludeSpam(next); setPage(0); }}
            label="Include spam"
          />
          <button type="button" className="secondaryButton cmBtn cmPageBtn" onClick={reload} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="cmToolbar cmToolbarStart">
        <label className="cmSelect">
          <span>Category</span>
          <select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(0); }}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label className="cmSelect">
          <span>Source</span>
          <select value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value); setPage(0); }}>
            <option value="">All sources</option>
            {CANDIDATE_SOURCES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="cmSelect">
          <span>Login</span>
          <select value={loginFilter} onChange={(event) => { setLoginFilter(event.target.value); setPage(0); }}>
            {LOGIN_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        {hasFilters && (
          <button type="button" className="secondaryButton cmBtn cmPageBtn" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <LoadingState label="Loading candidates…" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={reload} />
      ) : pageData.content.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No candidates"
          message={
            hasFilters
              ? "No candidates match the current filters."
              : includeSpam
                ? "No candidates have registered or applied yet."
                : "No candidates yet. Spam-flagged profiles stay hidden until you include them."
          }
        />
      ) : (
        <>
          <div className="cmTableWrap">
            <table className="cmTable" style={{ minWidth: 1180 }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Candidate</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>City</th>
                  <th>Experience</th>
                  <th>Category</th>
                  <th>Source</th>
                  <th className="cmColCenter">Login</th>
                  <th className="cmColCenter">Resume</th>
                  <th className="cmColCenter">Apps</th>
                  <th className="cmColCenter">Spam</th>
                  <th>Registered</th>
                  <th className="cmColActions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageData.content.map((candidate) => (
                  <tr key={candidate.id}>
                    <td><span className="cmCode">#{candidate.id}</span></td>
                    <td>
                      <div className="cmEntity">
                        <span className="cmIconTile"><UsersRound size={16} /></span>
                        <span>
                          <strong>{candidate.fullName || "—"}</strong>
                          {candidate.spamSuspected && <small className="cmMuted cmBlock">Spam suspected</small>}
                        </span>
                      </div>
                    </td>
                    <td className="cmMuted">{candidate.email || "—"}</td>
                    <td className="cmMuted">{candidate.phone || "—"}</td>
                    <td className="cmMuted">{candidate.city || "—"}</td>
                    <td className="cmMuted">{candidate.experienceLabel || "—"}</td>
                    <td className="cmMuted">{candidate.preferredCategoryName || "—"}</td>
                    <td><SourceChip source={candidate.source} /></td>
                    <td className="cmColCenter">
                      <Chip tone={candidate.hasLogin ? "success" : "neutral"}>
                        {candidate.hasLogin ? "Registered" : "Guest"}
                      </Chip>
                    </td>
                    <td className="cmColCenter">
                      <Chip tone={candidate.hasResume ? "success" : "warn"}>
                        {candidate.hasResume ? "Yes" : "No"}
                      </Chip>
                    </td>
                    <td className="cmColCenter">
                      <span className="cmCode">{candidate.applicationCount || 0}</span>
                    </td>
                    <td className="cmColCenter">
                      {candidate.spamSuspected ? <Chip tone="danger">Spam</Chip> : <span className="cmMuted">—</span>}
                    </td>
                    <td className="cmMuted">{formatDateTime(candidate.createdAt)}</td>
                    <td className="cmColActions">
                      <div className="cmRowActions">
                        <button
                          type="button"
                          className="cmIconButton"
                          aria-label={`View ${candidate.fullName || "candidate"}`}
                          title="View details"
                          onClick={() => setDetailId(candidate.id)}
                        >
                          <Eye size={15} />
                        </button>
                        {caps.canEdit && (
                          <button
                            type="button"
                            className="cmIconButton"
                            aria-label={`Edit ${candidate.fullName || "candidate"}`}
                            title="Edit"
                            onClick={() => openEdit(candidate)}
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                        {caps.canUploadResume && (
                          <button
                            type="button"
                            className="cmIconButton"
                            aria-label={`Upload resume for ${candidate.fullName || "candidate"}`}
                            title={candidate.hasResume ? "Replace resume" : "Upload resume"}
                            onClick={() => pickResume(candidate)}
                            disabled={resumeBusy}
                          >
                            <UploadCloud size={15} />
                          </button>
                        )}
                        {caps.canSpam && (
                          <button
                            type="button"
                            className="cmIconButton"
                            aria-label={candidate.spamSuspected ? "Clear spam flag" : "Flag as spam"}
                            title={candidate.spamSuspected ? "Clear spam flag" : "Flag as spam"}
                            onClick={() =>
                              setConfirm({
                                type: candidate.spamSuspected ? "unspam" : "spam",
                                candidate,
                              })
                            }
                          >
                            {candidate.spamSuspected ? <ShieldCheck size={15} /> : <ShieldAlert size={15} />}
                          </button>
                        )}
                        {caps.canDelete && (
                          <button
                            type="button"
                            className="cmIconButton cmIconDanger"
                            aria-label={`Delete ${candidate.fullName || "candidate"}`}
                            title="Delete"
                            onClick={() => setConfirm({ type: "delete", candidate })}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cmPagination">
            <button
              type="button"
              className="secondaryButton cmBtn cmPageBtn"
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              disabled={page <= 0 || loading}
            >
              <ChevronLeft size={15} /> Previous
            </button>
            <span className="cmPageInfo">Page {current} of {Math.max(totalPages, 1)}</span>
            <button
              type="button"
              className="secondaryButton cmBtn cmPageBtn"
              onClick={() => setPage((value) => (value + 1 < totalPages ? value + 1 : value))}
              disabled={page + 1 >= totalPages || loading}
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </>
      )}

      <input
        ref={resumeInputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: "none" }}
        onChange={onResumePicked}
        disabled={resumeBusy}
      />

      {formState && (
        <CandidateFormModal
          mode={formState.mode}
          candidateId={formState.candidateId}
          categories={categories}
          onClose={() => setFormState(null)}
          onSaved={handleSaved}
        />
      )}

      {detailId && (
        <CandidateDetailModal
          key={`${detailId}:${detailVersion}`}
          candidateId={detailId}
          canManage={caps.canManage}
          canDelete={caps.canDelete}
          canSpam={caps.canSpam}
          canViewNotes={caps.canViewNotes}
          onClose={() => setDetailId(null)}
          onEdit={(candidate) => {
            setDetailId(null);
            openEdit(candidate);
          }}
          onRequestDelete={(candidate) => setConfirm({ type: "delete", candidate })}
          onRequestSpam={(candidate, nextSpam) =>
            setConfirm({ type: nextSpam ? "spam" : "unspam", candidate })
          }
          onChanged={reload}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={
            confirm.type === "delete"
              ? "Delete candidate"
              : confirm.type === "spam"
                ? "Flag candidate as spam"
                : "Clear spam flag"
          }
          message={
            confirm.type === "delete"
              ? `Delete ${confirm.candidate.fullName || `candidate #${confirm.candidate.id}`}? This removes the candidate from normal active management views. Candidates who have joined cannot be deleted because their recruitment record must be retained.`
              : confirm.type === "spam"
                ? `Flag ${confirm.candidate.fullName || `candidate #${confirm.candidate.id}`} as spam? The profile stays stored but is hidden from the default list until spam is included.`
                : `Clear the spam flag on ${confirm.candidate.fullName || `candidate #${confirm.candidate.id}`}? The candidate returns to the normal list.`
          }
          confirmLabel={
            confirm.type === "delete"
              ? "Delete candidate"
              : confirm.type === "spam"
                ? "Flag as spam"
                : "Clear flag"
          }
          busy={confirmBusy}
          onConfirm={runConfirm}
          onCancel={() => {
            if (!confirmBusy) setConfirm(null);
          }}
        />
      )}
    </div>
  );
}
