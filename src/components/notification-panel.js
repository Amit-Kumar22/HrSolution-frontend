"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../lib/adminApi";
import { canViewNotifications } from "../lib/feature-access";
import {
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHead,
  formatDateTime,
} from "../app/admin/admin-ui";
import styles from "./notification-panel.module.css";

function readState(item) {
  for (const key of ["read", "isRead"]) {
    if (typeof item[key] === "boolean") return item[key];
  }
  if (Object.prototype.hasOwnProperty.call(item, "readAt")) return item.readAt != null;
  for (const key of ["readStatus", "status"]) {
    if (typeof item[key] === "string") {
      const state = item[key].trim().toLowerCase();
      if (state === "read") return true;
      if (state === "unread" || state === "new") return false;
    }
  }
  return null;
}

function notificationDate(item) {
  for (const key of ["createdAt", "notificationDate", "date", "timestamp", "holidayDate"]) {
    if (item[key]) return item[key];
  }
  return null;
}

function renderValue(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function NotificationPanel({ session, onNotificationsChanged }) {
  const allowed = canViewNotifications(session);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [countError, setCountError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    setCountError("");
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!allowed) return undefined;
    let active = true;
    listNotifications()
      .then((result) => {
        if (active) {
          setItems(result);
          setError("");
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Notifications could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    getUnreadNotificationCount()
      .then((count) => {
        if (active) {
          setUnreadCount(count);
          setCountError("");
        }
      })
      .catch((requestError) => {
        if (active) setCountError(requestError instanceof Error ? requestError.message : "Unread notification count could not be loaded.");
      });
    return () => { active = false; };
  }, [allowed, reloadKey]);

  async function markRead(id) {
    if (busyId != null || id == null) return;
    setBusyId(id);
    setActionError("");
    setSuccess("");
    try {
      await markNotificationRead(id);
      setSuccess("Notification marked as read.");
      reload();
      onNotificationsChanged?.();
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "The notification could not be marked as read.");
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    if (markingAll) return;
    setMarkingAll(true);
    setActionError("");
    setSuccess("");
    try {
      await markAllNotificationsRead();
      setSuccess("All notifications were marked as read.");
      reload();
      onNotificationsChanged?.();
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Notifications could not be marked as read.");
    } finally {
      setMarkingAll(false);
    }
  }

  if (!allowed) {
    return <div className={styles.denied} role="alert">Notifications are not available for this account.</div>;
  }

  return (
    <section className={`cmNotificationsPanel ${styles.panel}`}>
      <SectionHead
        title="Notifications"
        description="Notifications returned for your authenticated account."
        action={(
          <div className={styles.actions}>
            {unreadCount > 0 && <button type="button" className="secondaryButton cmBtn" onClick={markAllRead} disabled={markingAll}><CheckCheck size={14} />{markingAll ? "Updating…" : "Mark all read"}</button>}
            <button type="button" className="secondaryButton cmBtn" onClick={reload} disabled={loading}><RefreshCw size={14} /> Refresh</button>
          </div>
        )}
      />
      {countError && <p className="actionError" role="alert">{countError}</p>}
      {actionError && <p className="actionError" role="alert">{actionError}</p>}
      {success && <p className="actionSuccess" role="status">{success}</p>}
      {unreadCount != null && <p className={styles.countText}>{unreadCount} unread notification{unreadCount === 1 ? "" : "s"}</p>}
      {loading ? <LoadingState label="Loading notifications…" /> : error ? <ErrorState message={error} onRetry={reload} /> : !items.length ? (
        <EmptyState icon={Bell} title="No notifications" message="There are no notifications for your account." />
      ) : (
        <div className={styles.list}>
          {items.map((item, index) => {
            const state = readState(item);
            const title = item.title || item.name || item.notificationType || "Notification";
            const message = item.message || item.description || item.notes || "";
            const excluded = new Set(["id", "title", "name", "notificationType", "message", "description", "notes", "createdAt", "notificationDate", "date", "timestamp", "holidayDate", "read", "isRead", "readAt", "readStatus"]);
            const extras = Object.entries(item).filter(([key]) => !excluded.has(key));
            const id = item.id;
            return (
              <article className={styles.item} key={id ?? index}>
                <div className={styles.itemHeader}>
                  <div>
                    <h2>{renderValue(title)}</h2>
                    <time>{formatDateTime(notificationDate(item))}</time>
                  </div>
                  {state == null
                    ? <Chip tone="neutral">Read status unavailable</Chip>
                    : <Chip tone={state ? "neutral" : "warn"}>{state ? "Read" : "Unread"}</Chip>}
                </div>
                {message && <p className={styles.message}>{renderValue(message)}</p>}
                {extras.length > 0 && (
                  <dl className={styles.details}>
                    {extras.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{renderValue(value)}</dd></div>)}
                  </dl>
                )}
                {state === false && id != null && (
                  <button type="button" className="cmLinkButton" onClick={() => markRead(id)} disabled={busyId === id}>
                    {busyId === id ? "Updating…" : "Mark as read"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
