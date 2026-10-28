"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  PencilLine,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  FlashBanner,
  LoadingState,
  Modal,
  useFlash,
} from "./admin-ui";
import { getAuthSession, hasPermission, hasRole } from "@/lib/auth";
import {
  addHoliday,
  deleteHoliday,
  getHolidayDateValue,
  getHolidayId,
  getHolidayName,
  listHolidays,
  updateHoliday,
} from "@/lib/holidayApi";

function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function formatDisplayDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatShortDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function isSameMonth(value, monthDate) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === monthDate.getFullYear() && date.getMonth() === monthDate.getMonth();
}

function buildHolidayFormDefaults(date = new Date()) {
  return {
    name: "",
    holidayDate: toDateInputValue(date),
    state: "",
    mandatory: false,
    notes: "",
  };
}

export default function HolidayManagementPanel({ session: passedSession, allowManagement = false } = {}) {
  const session = passedSession || getAuthSession();
  const canManage = Boolean(allowManagement) && hasPermission(session, "SETTINGS_MANAGE") && hasRole(session, ["SUPER_ADMIN", "ADMIN"]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [currentMonth, setCurrentMonth] = useState(toMonthStart(new Date()));
  const [stateFilter, setStateFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedHolidayId, setSelectedHolidayId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(buildHolidayFormDefaults());
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [flash, showFlash] = useFlash();

  const stateOptions = useMemo(() => {
    const values = new Set(["ALL"]);
    for (const item of holidays) {
      const value = String(item?.state || "").trim();
      if (value) values.add(value);
    }
    return [...values];
  }, [holidays]);

  const filteredHolidays = useMemo(() => {
    const list = [...holidays].sort((a, b) => {
      const av = new Date(getHolidayDateValue(a) || "").getTime();
      const bv = new Date(getHolidayDateValue(b) || "").getTime();
      return av - bv;
    });

    return list.filter((item) => {
      const dateValue = getHolidayDateValue(item);
      if (!dateValue) return false;
      if (stateFilter !== "ALL") {
        const stateValue = String(item?.state || "").trim();
        if (stateValue !== stateFilter) return false;
      }
      if (fromDate && new Date(dateValue) < new Date(`${fromDate}T00:00:00`)) return false;
      if (toDate && new Date(dateValue) > new Date(`${toDate}T23:59:59`)) return false;
      return true;
    });
  }, [holidays, fromDate, stateFilter, toDate]);

  useEffect(() => {
    if (!session || !session.accessToken) return undefined;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await listHolidays({
          from: fromDate || undefined,
          to: toDate || undefined,
          state: stateFilter === "ALL" ? undefined : stateFilter,
        });
        if (cancelled) return;
        setHolidays(Array.isArray(result) ? result : []);
      } catch (err) {
        if (cancelled) return;
        setHolidays([]);
        setError(err instanceof Error ? err.message : "Holidays could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [fromDate, reloadToken, session, stateFilter, toDate]);

  useEffect(() => {
    if (!filteredHolidays.length) {
      setSelectedHolidayId("");
      return;
    }
    const existing = filteredHolidays.some((item) => getHolidayId(item) === selectedHolidayId);
    if (!existing) setSelectedHolidayId(getHolidayId(filteredHolidays[0]));
  }, [filteredHolidays, selectedHolidayId]);

  const selectedHoliday = filteredHolidays.find((item) => getHolidayId(item) === selectedHolidayId) || filteredHolidays[0] || null;

  const monthHolidayMap = useMemo(() => {
    const map = new Map();
    for (const item of filteredHolidays) {
      const dateValue = getHolidayDateValue(item);
      if (!dateValue) continue;
      if (isSameMonth(dateValue, currentMonth)) {
        const key = toDateInputValue(dateValue);
        const bucket = map.get(key) || [];
        bucket.push(item);
        map.set(key, bucket);
      }
    }
    return map;
  }, [currentMonth, filteredHolidays]);

  const monthCells = useMemo(() => {
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const start = addDays(firstDay, -firstDay.getDay());
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [currentMonth]);

  function refreshHolidays() {
    setReloadToken((value) => value + 1);
  }

  function openCreateDialog() {
    setEditingId("");
    setForm(buildHolidayFormDefaults(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)));
    setFormErrors({});
    setModalOpen(true);
  }

  function openEditDialog(item) {
    setEditingId(getHolidayId(item));
    setForm({
      name: getHolidayName(item),
      holidayDate: toDateInputValue(getHolidayDateValue(item) || new Date()),
      state: String(item?.state || "").trim(),
      mandatory: Boolean(item?.mandatory),
      notes: String(item?.notes || "").trim(),
    });
    setFormErrors({});
    setModalOpen(true);
  }

  function closeDialog() {
    setModalOpen(false);
    setEditingId("");
    setFormErrors({});
    setForm(buildHolidayFormDefaults());
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: "" }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Holiday name is required.";
    if (!form.holidayDate) nextErrors.holidayDate = "Holiday date is required.";
    if (!form.state.trim()) nextErrors.state = "State is required.";

    if (Object.keys(nextErrors).length) {
      setFormErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setFormErrors({});

    try {
      const payload = {
        name: form.name.trim(),
        holidayDate: form.holidayDate,
        state: form.state.trim(),
        mandatory: Boolean(form.mandatory),
        notes: form.notes.trim(),
      };

      if (editingId) {
        await updateHoliday(editingId, payload);
        showFlash("success", "Holiday updated successfully.");
      } else {
        await addHoliday(payload);
        showFlash("success", "Holiday added successfully.");
      }

      closeDialog();
      refreshHolidays();
    } catch (err) {
      const message = err instanceof Error ? err.message : "The holiday could not be saved.";
      showFlash("error", message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(item) {
    setDeleteTarget(item);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteHoliday(getHolidayId(deleteTarget));
      showFlash("success", "Holiday deleted successfully.");
      setDeleteTarget(null);
      refreshHolidays();
    } catch (err) {
      const message = err instanceof Error ? err.message : "The holiday could not be deleted.";
      showFlash("error", message);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.2 }}>Holiday Calendar</h1>
          <p style={{ margin: "4px 0 0", color: "#586d84", fontSize: 12 }}>
            {canManage ? "Manage company holidays and review state-specific calendars." : "Review the official holiday calendar and upcoming public holiday dates."}
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            className="primaryButton"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, padding: "8px 12px" }}
            onClick={openCreateDialog}
          >
            <Plus size={14} /> Add Holiday
          </button>
        )}
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 6, fontWeight: 600, color: "#23415d", fontSize: 12 }}>
          From date
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 6, fontWeight: 600, color: "#23415d", fontSize: 12 }}>
          To date
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 6, fontWeight: 600, color: "#23415d", fontSize: 12 }}>
          State
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} style={inputStyle}>
            {stateOptions.map((option) => (
              <option key={option} value={option}>{option === "ALL" ? "All states" : option}</option>
            ))}
          </select>
        </label>

        {(fromDate || toDate || stateFilter !== "ALL") && (
          <button
            type="button"
            className="secondaryButton"
            style={{ alignSelf: "end", fontSize: 12, padding: "8px 12px" }}
            onClick={() => {
              setFromDate("");
              setToDate("");
              setStateFilter("ALL");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {flash && <FlashBanner flash={flash} />}

      {loading ? (
        <LoadingState label="Loading holiday calendar…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refreshHolidays} />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(260px, 1fr)", gap: 16 }}>
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} style={navButtonStyle} aria-label="Previous month">
                  <ChevronLeft size={16} />
                </button>
                <strong style={{ fontSize: 16 }}>{currentMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
                <button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} style={navButtonStyle} aria-label="Next month">
                  <ChevronRight size={16} />
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
                  <div key={label} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#677d94", paddingBottom: 6 }}>
                    {label}
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
                {monthCells.map((dayDate) => {
                  const key = toDateInputValue(dayDate);
                  const dayHolidays = monthHolidayMap.get(key) || [];
                  const active = dayHolidays.some((item) => getHolidayId(item) === selectedHoliday?.id || getHolidayId(item) === selectedHolidayId);
                  const today = new Date();
                  const isToday = key === toDateInputValue(today);

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (dayHolidays.length) {
                          setSelectedHolidayId(getHolidayId(dayHolidays[0]));
                        }
                      }}
                      style={{
                        ...dayCellStyle,
                        background: active ? "#eaf5ff" : dayDate.getMonth() !== currentMonth.getMonth() ? "#f9fafb" : "#fff",
                        borderColor: active ? "#0f4c81" : isToday ? "#d4e8ff" : "#e6edf5",
                        color: dayDate.getMonth() !== currentMonth.getMonth() ? "#96a9ba" : "#19364d",
                        minHeight: 84,
                        textAlign: "left",
                        padding: 6,
                      }}
                    >
                      <span style={{ display: "inline-flex", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
                        {dayDate.getDate()}
                        {isToday && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#0f4c81", display: "inline-block", marginLeft: 6, marginTop: 3 }} />}
                      </span>

                      <div style={{ display: "grid", gap: 4 }}>
                        {dayHolidays.slice(0, 2).map((holiday) => (
                          <span
                            key={getHolidayId(holiday) || `${key}-${getHolidayName(holiday)}`}
                            style={{
                              display: "block",
                              background: holiday.mandatory ? "#fef3c7" : "#e5f0ff",
                              color: holiday.mandatory ? "#7c4a09" : "#0f4c81",
                              borderRadius: 6,
                              padding: "2px 4px",
                              fontSize: 10,
                              fontWeight: 700,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {getHolidayName(holiday)}
                          </span>
                        ))}
                        {dayHolidays.length > 2 && <span style={{ fontSize: 9, color: "#576f87" }}>+{dayHolidays.length - 2} more</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <aside style={cardStyle}>
              {selectedHoliday ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280" }}>Selected holiday</div>
                      <h2 style={{ margin: "4px 0 0", fontSize: 20 }}>{getHolidayName(selectedHoliday)}</h2>
                    </div>
                    {canManage && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" onClick={() => openEditDialog(selectedHoliday)} style={smallActionButtonStyle} aria-label="Edit holiday">
                          <PencilLine size={14} />
                        </button>
                        <button type="button" onClick={() => handleDelete(selectedHoliday)} style={{ ...smallActionButtonStyle, borderColor: "#fecaca", color: "#b91c1c" }} aria-label="Delete holiday">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <CalendarDays size={14} color="#0f4c81" />
                      <span>{formatDisplayDate(getHolidayDateValue(selectedHoliday))}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <Star size={14} color={selectedHoliday.mandatory ? "#d97706" : "#64748b"} />
                      <span>{selectedHoliday.mandatory ? "Mandatory holiday" : "Optional / local holiday"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#0f4c81" }} />
                      <span>{selectedHoliday.state || "National"}</span>
                    </div>
                    {selectedHoliday.notes && (
                      <div style={{ padding: "8px 10px", background: "#f8fafc", borderRadius: 10, color: "#415567", fontSize: 12, lineHeight: 1.5 }}>
                        {selectedHoliday.notes}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <EmptyState icon={CalendarDays} title="No holiday selected" message="Choose a highlighted date in the calendar to view details." />
              )}
            </aside>
          </div>

          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <strong style={{ fontSize: 15 }}>Holiday list</strong>
              <span style={{ fontSize: 11, color: "#6b7280" }}>{filteredHolidays.length} result{filteredHolidays.length === 1 ? "" : "s"}</span>
            </div>

            {filteredHolidays.length ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 540 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "#5c6f82", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      <th style={tableHeaderStyle}>Name</th>
                      <th style={tableHeaderStyle}>Date</th>
                      <th style={tableHeaderStyle}>State</th>
                      <th style={tableHeaderStyle}>Type</th>
                      {canManage && <th style={tableHeaderStyle}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHolidays.map((holiday) => {
                      const id = getHolidayId(holiday);
                      const selected = id === selectedHolidayId;
                      return (
                        <tr key={id || `${getHolidayDateValue(holiday)}-${getHolidayName(holiday)}`} style={{ borderTop: "1px solid #edf2f7", background: selected ? "#f5fbff" : "transparent" }}>
                          <td style={tableCellStyle}>
                            <button type="button" onClick={() => setSelectedHolidayId(id)} style={{ background: "none", border: 0, padding: 0, color: "#12314d", fontWeight: 700, fontSize: 12, cursor: "pointer", textAlign: "left" }}>
                              {getHolidayName(holiday)}
                            </button>
                          </td>
                          <td style={tableCellStyle}>{formatShortDate(getHolidayDateValue(holiday))}</td>
                          <td style={tableCellStyle}>{holiday.state || "National"}</td>
                          <td style={tableCellStyle}>
                            <span style={{
                              display: "inline-flex",
                              padding: "4px 7px",
                              borderRadius: 999,
                              background: holiday.mandatory ? "#fef3c7" : "#e5f0ff",
                              color: holiday.mandatory ? "#7c4a09" : "#0f4c81",
                              fontSize: 10,
                              fontWeight: 700,
                            }}>
                              {holiday.mandatory ? "Mandatory" : "Optional"}
                            </span>
                          </td>
                          {canManage && (
                            <td style={tableCellStyle}>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button type="button" onClick={() => openEditDialog(holiday)} style={smallActionButtonStyle} aria-label={`Edit ${getHolidayName(holiday)}`}>
                                  <PencilLine size={12} />
                                </button>
                                <button type="button" onClick={() => handleDelete(holiday)} style={{ ...smallActionButtonStyle, borderColor: "#fecaca", color: "#b91c1c" }} aria-label={`Delete ${getHolidayName(holiday)}`}>
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={CalendarDays} title="No holidays found" message="Try a different date range or reset the filters to view upcoming dates." />
            )}
          </div>
        </>
      )}

      {modalOpen && (
        <Modal
          title={editingId ? "Edit holiday" : "Add holiday"}
          description={editingId ? "Update the holiday details and save changes." : "Add a new holiday to the company calendar."}
          onClose={closeDialog}
          wide
        >
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <Field label="Holiday name" required error={formErrors.name}>
                <input
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  style={inputStyle}
                  placeholder="Example: Independence Day"
                />
              </Field>

              <Field label="Holiday date" required error={formErrors.holidayDate}>
                <input
                  type="date"
                  value={form.holidayDate}
                  onChange={(event) => updateForm("holidayDate", event.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <Field label="State" required error={formErrors.state}>
                <input
                  value={form.state}
                  onChange={(event) => updateForm("state", event.target.value)}
                  style={inputStyle}
                  placeholder="National or State name"
                />
              </Field>

              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 18 }}>
                <input
                  id="holiday-mandatory"
                  type="checkbox"
                  checked={form.mandatory}
                  onChange={(event) => updateForm("mandatory", event.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <label htmlFor="holiday-mandatory" style={{ fontSize: 12, color: "#23415d", fontWeight: 600 }}>
                  Mandatory holiday
                </label>
              </div>
            </div>

            <Field label="Notes">
              <textarea
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                rows={4}
                style={{ ...inputStyle, resize: "vertical", minHeight: 100 }}
                placeholder="Optional details for this holiday"
              />
            </Field>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="secondaryButton" onClick={closeDialog} style={{ fontSize: 12, padding: "8px 12px" }}>
                Cancel
              </button>
              <button type="submit" className="primaryButton" disabled={submitting} style={{ fontSize: 12, padding: "8px 12px" }}>
                {submitting ? (editingId ? "Saving…" : "Creating…") : editingId ? "Save changes" : "Add holiday"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete holiday"
          message={`Are you sure you want to delete “${getHolidayName(deleteTarget)}” from the holiday calendar?`}
          confirmLabel="Delete"
          confirmVariant="danger"
          busy={submitting}
          onConfirm={async () => {
            setSubmitting(true);
            try {
              await deleteHoliday(getHolidayId(deleteTarget));
              showFlash("success", "Holiday deleted successfully.");
              setDeleteTarget(null);
              refreshHolidays();
            } catch (err) {
              const message = err instanceof Error ? err.message : "The holiday could not be deleted.";
              showFlash("error", message);
            } finally {
              setSubmitting(false);
            }
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

const cardStyle = {
  background: "#fff",
  border: "1px solid #e6edf5",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 8px 30px rgba(15, 23, 42, 0.04)",
};

const inputStyle = {
  width: "100%",
  minHeight: 38,
  background: "#fff",
  border: "1px solid #dfe8f1",
  borderRadius: 10,
  padding: "8px 10px",
  fontSize: 12,
  color: "#12314d",
  outline: "none",
};

const navButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  border: "1px solid #dfe8f1",
  background: "#f8fafc",
  color: "#12314d",
  borderRadius: 8,
  cursor: "pointer",
};

const dayCellStyle = {
  border: "1px solid #e6edf5",
  borderRadius: 10,
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const smallActionButtonStyle = {
  border: "1px solid #dbe5f0",
  background: "#fff",
  color: "#0f4c81",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 8,
  cursor: "pointer",
};

const tableHeaderStyle = {
  padding: "10px 8px",
  borderBottom: "1px solid #edf2f7",
  fontWeight: 700,
};

const tableCellStyle = {
  padding: "10px 8px",
  fontSize: 12,
  color: "#21425d",
  verticalAlign: "middle",
};
