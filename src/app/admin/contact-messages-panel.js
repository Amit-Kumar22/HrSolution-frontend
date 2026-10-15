"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Mail,
  MailOpen,
  Reply,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  deleteContactMessage,
  getContactMessage,
  listContactMessages,
  markContactMessageReplied,
  setContactMessageRead,
  setContactMessageSpam,
} from "@/lib/adminApi";
import {
  Chip,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FlashBanner,
  LoadingState,
  Modal,
  Notice,
  SectionHead,
  Switch,
  formatDateTime,
  useFlash,
} from "./admin-ui";

const READ_FILTERS = [
  { value: "", label: "All messages" },
  { value: "unread", label: "Unread only" },
  { value: "read", label: "Read only" },
];

const SORT_OPTIONS = [
  { value: "createdAt,DESC", label: "Newest first" },
  { value: "createdAt,ASC", label: "Oldest first" },
];

const PAGE_SIZES = [10, 20, 50, 100];

function preview(message, length = 150) {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  if (text.length <= length) return text;
  return `${text.slice(0, length)}…`;
}

export default function ContactMessagesPanel({ onUnreadChange }) {
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
  const [readFilter, setReadFilter] = useState("");
  const [includeSpam, setIncludeSpam] = useState(false);
  const [sortValue, setSortValue] = useState("createdAt,DESC");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const detailSeq = useRef(0);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listContactMessages({
          search,
          read: readFilter === "" ? undefined : readFilter === "read",
          includeSpam,
          page,
          size,
          sort: [sortValue],
        });
        if (cancelled) return;
        setPageData(data);
        setLoadError("");
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Contact messages could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search, readFilter, includeSpam, page, size, sortValue, reloadToken]);

  function reload() {
    setLoading(true);
    setReloadToken((token) => token + 1);
  }

  function notifyUnread() {
    if (typeof onUnreadChange === "function") onUnreadChange();
  }

  async function runAction(work, successMessage, item) {
    if (busyId) return;
    setBusyId(item.id);
    try {
      const updated = await work();
      showFlash("success", successMessage);
      reload();
      notifyUnread();
      if (detail && detail.id === item.id && updated) {
        setDetail((previous) => ({ ...previous, ...updated }));
      }
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "The action could not be completed.");
    } finally {
      setBusyId(null);
    }
  }

  function toggleRead(item, nextRead) {
    return runAction(
      () => setContactMessageRead(item.id, nextRead),
      nextRead ? "Message marked as read." : "Message marked as unread.",
      item,
    );
  }

  function handleReplied(item) {
    return runAction(() => markContactMessageReplied(item.id), "Message marked as replied.", item);
  }

  function toggleSpam(item) {
    const next = !item.spam;
    return runAction(
      () => setContactMessageSpam(item.id, next),
      next ? "Message moved to spam." : "Message recovered from spam.",
      item,
    );
  }

  function openDetail(item) {
    const seq = ++detailSeq.current;
    setDetail(item);
    setDetailError("");
    setDetailLoading(true);
    getContactMessage(item.id)
      .then((full) => {
        if (detailSeq.current === seq) setDetail(full || item);
      })
      .catch((error) => {
        if (detailSeq.current === seq) {
          setDetailError(error instanceof Error ? error.message : "The full message could not be loaded.");
        }
      })
      .finally(() => {
        if (detailSeq.current === seq) setDetailLoading(false);
      });
  }

  function closeDetail() {
    detailSeq.current += 1;
    setDetail(null);
    setDetailError("");
    setDetailLoading(false);
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteContactMessage(deleteTarget.id);
      showFlash("success", "Contact message deleted.");
      if (detail && detail.id === deleteTarget.id) closeDetail();
      setDeleteTarget(null);
      notifyUnread();
      if (pageData.content.length === 1 && page > 0) {
        setPage((current) => current - 1);
      } else {
        reload();
      }
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "The message could not be deleted.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = pageData.totalPages || 0;
  const current = Math.min(page + 1, Math.max(totalPages, 1));
  const unreadOnPage = pageData.content.filter((item) => !item.read).length;

  return (
    <div className="cmContactPanel">
      <SectionHead
        title="Contact messages"
        description="Messages submitted through the public contact form. Opening a message does not mark it as read."
      />

      <FlashBanner flash={flash} />

      <div className="cmToolbar">
        <label className="cmSearchBox">
          <Search size={16} />
          <input
            type="search"
            value={searchInput}
            placeholder="Search name, email, phone or message"
            aria-label="Search contact messages"
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>
        <div className="cmToolbarControls">
          <span className="cmCount">
            {pageData.totalElements} message{pageData.totalElements === 1 ? "" : "s"}
          </span>
          <label className="cmSelect">
            <span>Show</span>
            <select value={readFilter} onChange={(event) => { setReadFilter(event.target.value); setPage(0); }}>
              {READ_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
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
            id="contact-include-spam"
            checked={includeSpam}
            onChange={(next) => { setIncludeSpam(next); setPage(0); }}
            label="Include spam"
          />
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading contact messages…" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={reload} />
      ) : pageData.content.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No contact messages"
          message={includeSpam ? "No messages match the current filters." : "Messages sent through the website contact form will appear here."}
        />
      ) : (
        <>
          {!includeSpam && unreadOnPage > 0 && (
            <p className="cmCount" style={{ marginBottom: 10 }}>
              {unreadOnPage} unread on this page
            </p>
          )}
          <div className="cmTableWrap">
            <table className="cmTable">
              <thead>
                <tr>
                  <th>Sender</th>
                  <th>Phone</th>
                  <th>Message</th>
                  <th>Received</th>
                  <th className="cmColCenter">Status</th>
                  <th className="cmColActions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageData.content.map((item) => (
                  <tr key={item.id} style={item.read ? undefined : { background: "#fffdf6" }}>
                    <td>
                      <div className="cmEntity">
                        <span className="cmIconTile"><Mail size={16} /></span>
                        <span>
                          <strong>{item.name || "Unknown sender"}</strong>
                          <small className="cmMuted cmBlock">{item.email || "—"}</small>
                        </span>
                      </div>
                    </td>
                    <td className="cmMuted">{item.phone || "—"}</td>
                    <td className="cmMuted cmNoWrap">{preview(item.message) || "—"}</td>
                    <td className="cmMuted cmNoWrap">{formatDateTime(item.createdAt)}</td>
                    <td className="cmColCenter">
                      <div className="cmStatusRow" style={{ justifyContent: "center" }}>
                        <Chip tone={item.read ? "neutral" : "warn"}>{item.read ? "Read" : "Unread"}</Chip>
                        {item.replied && <Chip tone="success">Replied</Chip>}
                        {item.spam && <Chip tone="danger">Spam</Chip>}
                      </div>
                    </td>
                    <td className="cmColActions">
                      <div className="cmRowActions">
                        <button type="button" className="cmIconButton" aria-label="View message" title="View" onClick={() => openDetail(item)}>
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          className="cmIconButton"
                          aria-label={item.read ? "Mark unread" : "Mark read"}
                          title={item.read ? "Mark unread" : "Mark read"}
                          disabled={busyId === item.id}
                          onClick={() => toggleRead(item, !item.read)}
                        >
                          {item.read ? <Mail size={15} /> : <MailOpen size={15} />}
                        </button>
                        <button
                          type="button"
                          className="cmIconButton"
                          aria-label="Mark replied"
                          title={item.replied ? "Replied" : "Mark replied"}
                          disabled={busyId === item.id || item.replied}
                          onClick={() => handleReplied(item)}
                        >
                          <Reply size={15} />
                        </button>
                        <button
                          type="button"
                          className="cmIconButton"
                          aria-label={item.spam ? "Recover from spam" : "Mark as spam"}
                          title={item.spam ? "Recover from spam" : "Mark as spam"}
                          disabled={busyId === item.id}
                          onClick={() => toggleSpam(item)}
                        >
                          {item.spam ? <ShieldCheck size={15} /> : <ShieldAlert size={15} />}
                        </button>
                        <button
                          type="button"
                          className="cmIconButton cmIconDanger"
                          aria-label="Delete message"
                          title="Delete"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 size={15} />
                        </button>
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

      {detail && (
        <Modal
          wide
          title={detail.name ? `Message from ${detail.name}` : "Contact message"}
          description={`Received ${formatDateTime(detail.createdAt)}`}
          onClose={closeDetail}
          footer={(
            <>
              <button
                type="button"
                className="cmDangerButton cmBtn"
                onClick={() => setDeleteTarget(detail)}
                disabled={busyId === detail.id}
              >
                <Trash2 size={15} /> Delete
              </button>
              <button type="button" className="secondaryButton cmBtn" onClick={closeDetail}>Close</button>
            </>
          )}
        >
          {detailError && <p className="actionError" role="alert">{detailError}</p>}
          {detailLoading && <Notice tone="info">Loading the full message…</Notice>}

          <div className="cmStatusRow">
            <Chip tone={detail.read ? "neutral" : "warn"}>{detail.read ? "Read" : "Unread"}</Chip>
            {detail.replied && <Chip tone="success">Replied</Chip>}
            {detail.spam && <Chip tone="danger">Spam</Chip>}
          </div>

          <div className="cmDetailGrid" style={{ marginTop: 16 }}>
            <div className="cmDetailRow">
              <span className="cmDetailLabel">Name</span>
              <span className="cmDetailValue">{detail.name || "—"}</span>
            </div>
            <div className="cmDetailRow">
              <span className="cmDetailLabel">Email</span>
              <span className="cmDetailValue">
                {detail.email ? <a href={`mailto:${detail.email}`}>{detail.email}</a> : "—"}
              </span>
            </div>
            <div className="cmDetailRow">
              <span className="cmDetailLabel">Phone</span>
              <span className="cmDetailValue">
                {detail.phone ? <a href={`tel:${detail.phone}`}>{detail.phone}</a> : "—"}
              </span>
            </div>
            <div className="cmDetailRow">
              <span className="cmDetailLabel">Received</span>
              <span className="cmDetailValue">{formatDateTime(detail.createdAt)}</span>
            </div>
            {detail.subject && (
              <div className="cmDetailRow cmDetailFull">
                <span className="cmDetailLabel">Subject</span>
                <span className="cmDetailValue">{detail.subject}</span>
              </div>
            )}
            <div className="cmDetailRow cmDetailFull">
              <span className="cmDetailLabel">Message</span>
              <p className="cmDetailMessage">{detail.message || "—"}</p>
            </div>
          </div>

          <div className="cmDetailSection">
            <h3>Actions</h3>
            <div className="cmDetailActions">
              <button
                type="button"
                className="secondaryButton cmBtn"
                disabled={busyId === detail.id}
                onClick={() => toggleRead(detail, !detail.read)}
              >
                {detail.read ? <Mail size={15} /> : <MailOpen size={15} />}
                {detail.read ? "Mark unread" : "Mark read"}
              </button>
              <button
                type="button"
                className="secondaryButton cmBtn"
                disabled={busyId === detail.id || detail.replied}
                onClick={() => handleReplied(detail)}
              >
                <Reply size={15} /> {detail.replied ? "Replied" : "Mark replied"}
              </button>
              <button
                type="button"
                className="secondaryButton cmBtn"
                disabled={busyId === detail.id}
                onClick={() => toggleSpam(detail)}
              >
                {detail.spam ? <ShieldCheck size={15} /> : <ShieldAlert size={15} />}
                {detail.spam ? "Recover from spam" : "Mark as spam"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete contact message"
          message={`Delete the message from “${deleteTarget.name || deleteTarget.email || "this sender"}”? This cannot be undone.`}
          confirmLabel="Delete message"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => { if (!deleting) setDeleteTarget(null); }}
        />
      )}
    </div>
  );
}
