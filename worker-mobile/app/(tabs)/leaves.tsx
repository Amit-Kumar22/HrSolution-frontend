/* Async API hydration intentionally updates state from an effect. */
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Screen, Card, State, styles } from "../../components/ui";
import { colors } from "../../constants/theme";
import { useAuth } from "../../hooks/useAuth";
import { apiMessage } from "../../services/api";
import { listLeaves, applyLeave, cancelLeave, workerId } from "../../services/worker";

const LEAVE_TYPES = ["CASUAL", "SICK", "ANNUAL", "MATERNITY", "PATERNITY", "EMERGENCY", "BEREAVEMENT"];

function coerceStatus(value: any) {
  const v = String(value ?? "").trim().toUpperCase();
  return v || "PENDING";
}

function getLeaveId(item: any) {
  return item?.id ?? item?.leaveId ?? item?.requestId;
}

function getLeaveDates(item: any) {
  const start = item?.fromDate ?? item?.startDate ?? item?.holidayDate ?? "";
  const end = item?.toDate ?? item?.endDate ?? item?.holidayEndDate ?? "";
  return { fromDate: start || end || "", toDate: end || start || "" };
}

function getLeaveReason(item: any) {
  return item?.reason ?? item?.notes ?? item?.remarks ?? item?.leaveReason ?? "No reason provided";
}

export default function Leaves() {
  const { session } = useAuth();
  const uid = workerId(session?.user);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState("");
  const [form, setForm] = useState({ fromDate: "", toDate: "", leaveType: "CASUAL", reason: "" });
  const [formErrors, setFormErrors] = useState<any>({});

  const load = async () => {
    if (!uid) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const data = await listLeaves(uid);
      setItems(Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : []);
    } catch (e) {
      setItems([]);
      setError(apiMessage(e, "Leave records could not be loaded."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [uid, reloadToken]);

  const summary = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    for (const e of items) {
      const s = coerceStatus(e?.status ?? e?.state ?? "PENDING");
      if (s === "PENDING") c.pending++;
      if (s === "APPROVED") c.approved++;
      if (s === "REJECTED") c.rejected++;
      if (s === "CANCELLED") c.cancelled++;
    }
    return c;
  }, [items]);

  function validate() {
    const errs: any = {};
    if (!form.fromDate) errs.fromDate = "Please select a start date.";
    if (!form.toDate) errs.toDate = "Please select an end date.";
    if (!form.leaveType) errs.leaveType = "Please select a leave type.";
    if (!form.reason.trim()) errs.reason = "Please describe the reason for leave.";
    if (form.fromDate && form.toDate) {
      const s = new Date(form.fromDate);
      const e = new Date(form.toDate);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e < s) errs.toDate = "To date cannot be earlier than from date.";
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await applyLeave({ fromDate: form.fromDate, toDate: form.toDate, leaveType: form.leaveType, reason: form.reason.trim() });
      setFlash("Leave request submitted successfully.");
      setShowForm(false);
      setForm({ fromDate: "", toDate: "", leaveType: "CASUAL", reason: "" });
      setFormErrors({});
      setReloadToken((v) => v + 1);
    } catch (e) {
      setFlash(apiMessage(e, "Your leave request could not be submitted."));
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(item: any) {
    const id = getLeaveId(item);
    if (!id) return;
    Alert.alert("Cancel leave", "Cancel this leave request?", [
      { text: "No", style: "cancel" },
      { text: "Yes", onPress: async () => {
        setBusyId(id);
        try {
          await cancelLeave(id);
          setFlash("Leave request cancelled.");
          setReloadToken((v) => v + 1);
        } catch (e) {
          setFlash(apiMessage(e, "The leave request could not be cancelled."));
        } finally {
          setBusyId(null);
        }
      } },
    ]);
  }

  return (
    <ScrollView>
      <Screen title="My leaves" subtitle="Track your leave requests and submit new applications.">
        {flash ? <Text style={{ color: colors.blue, marginBottom: 10 }}>{flash}</Text> : null}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>My Leaves</Text>
          <Pressable onPress={() => setShowForm((v) => !v)} style={{ backgroundColor: colors.blue, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>{showForm ? "Close" : "Apply for Leave"}</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <Card><Text style={styles.muted}>Pending</Text><Text style={{ fontSize: 20, fontWeight: "900", color: colors.ink }}>{summary.pending}</Text></Card>
          <Card><Text style={styles.muted}>Approved</Text><Text style={{ fontSize: 20, fontWeight: "900", color: colors.ink }}>{summary.approved}</Text></Card>
          <Card><Text style={styles.muted}>Rejected</Text><Text style={{ fontSize: 20, fontWeight: "900", color: colors.ink }}>{summary.rejected}</Text></Card>
        </View>

        {showForm && (
          <Card>
            <Text style={styles.section}>Apply for Leave</Text>
            <Text style={styles.label}>From date (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={form.fromDate} onChangeText={(v) => setForm((f) => ({ ...f, fromDate: v }))} placeholder="2026-10-30" />
            {formErrors.fromDate ? <Text style={styles.error}>{formErrors.fromDate}</Text> : null}
            <Text style={styles.label}>To date (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={form.toDate} onChangeText={(v) => setForm((f) => ({ ...f, toDate: v }))} placeholder="2026-10-31" />
            {formErrors.toDate ? <Text style={styles.error}>{formErrors.toDate}</Text> : null}
            <Text style={styles.label}>Leave type</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {LEAVE_TYPES.map((t) => (
                <Pressable key={t} onPress={() => setForm((f) => ({ ...f, leaveType: t }))} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: form.leaveType === t ? colors.blue : colors.pale }}>
                  <Text style={{ color: form.leaveType === t ? "#fff" : colors.ink, fontSize: 11, fontWeight: "700" }}>{t}</Text>
                </Pressable>
              ))}
            </View>
            {formErrors.leaveType ? <Text style={styles.error}>{formErrors.leaveType}</Text> : null}
            <Text style={styles.label}>Reason</Text>
            <TextInput style={[styles.input, { minHeight: 80 }]} multiline value={form.reason} onChangeText={(v) => setForm((f) => ({ ...f, reason: v }))} placeholder="Explain the reason" />
            {formErrors.reason ? <Text style={styles.error}>{formErrors.reason}</Text> : null}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Pressable onPress={() => setShowForm(false)} disabled={submitting} style={[styles.outline, { flex: 1, padding: 12, borderRadius: 10, alignItems: "center" }]}>
                <Text style={{ color: colors.blue, fontWeight: "700" }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submit} disabled={submitting} style={{ flex: 1, padding: 12, borderRadius: 10, alignItems: "center", backgroundColor: colors.blue, opacity: submitting ? 0.55 : 1 }}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>{submitting ? "Submitting..." : "Submit leave request"}</Text>
              </Pressable>
            </View>
          </Card>
        )}

        {loading || error || !items.length ? (
          <State loading={loading} error={error} empty="No leave records found." onRetry={load} />
        ) : (
          items.map((item, i) => {
            const status = coerceStatus(item?.status ?? item?.state ?? "PENDING");
            const id = getLeaveId(item);
            const dates = getLeaveDates(item);
            const canCancel = status === "PENDING";
            return (
              <Card key={id ?? i}>
                <View style={styles.row}>
                  <Text style={{ fontWeight: "800", color: colors.ink }}>{item.leaveType || item.type || "Leave"}</Text>
                  <Text style={styles.badge}>{status}</Text>
                </View>
                <Text style={styles.muted}>{dates.fromDate || ""} to {dates.toDate || ""}</Text>
                <Text style={{ color: colors.muted, marginTop: 6 }}>{getLeaveReason(item)}</Text>
                {canCancel && (
                  <Pressable onPress={() => cancel(item)} disabled={busyId === id} style={{ marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: "#fee5e5", alignItems: "center", opacity: busyId === id ? 0.55 : 1 }}>
                    <Text style={{ color: colors.danger, fontWeight: "700" }}>{busyId === id ? "Cancelling..." : "Cancel"}</Text>
                  </Pressable>
                )}
              </Card>
            );
          })
        )}
      </Screen>
    </ScrollView>
  );
}
