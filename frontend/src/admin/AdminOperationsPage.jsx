import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import { DashboardLayout, DashboardSection } from "../dashboard/DashboardLayout";
import { ErrorState, LoadingState } from "../components/AsyncState";
import api from "../lib/api";
import { errorMessage, formatDateTime } from "../lib/format";

const disputeOutcomes = [
  "resolved_buyer_favour",
  "resolved_seller_favour",
  "resolved_compromise",
  "closed",
];

export default function AdminOperationsPage() {
  const [disputes, setDisputes] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const results = await Promise.allSettled([
      api.get("/disputes/admin?limit=100&offset=0"),
      api.get("/reviews/reports/admin"),
    ]);
    const failures = [];
    if (results[0].status === "fulfilled") setDisputes(results[0].value.data.data || []);
    else failures.push(errorMessage(results[0].reason, "Disputes could not be loaded."));
    if (results[1].status === "fulfilled") setReports(results[1].value.data.data || []);
    else failures.push(errorMessage(results[1].reason, "Review reports could not be loaded."));
    setError(failures.join(" "));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (request, success) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request();
      setNotice(success);
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const resolveDispute = (dispute) => {
    const resolutionOutcome = window.prompt(`Outcome: ${disputeOutcomes.join(", ")}`, "resolved_compromise");
    if (!resolutionOutcome || !disputeOutcomes.includes(resolutionOutcome)) return;
    const resolutionNotes = window.prompt("Audited resolution notes (at least 10 characters):", "");
    if (!resolutionNotes) return;
    run(
      () => api.post(`/disputes/${dispute.id}/resolve`, { resolutionOutcome, resolutionNotes }),
      `Dispute ${dispute.disputeReference} resolved.`,
    );
  };

  const moderateReport = (report, action) => {
    const moderationReason = window.prompt("Moderation reason (at least 5 characters):", "");
    if (!moderationReason) return;
    run(
      () => api.post(`/reviews/${report.reviewId}/moderate`, { action, moderationReason, reportId: report.id }),
      `Review report #${report.id} processed.`,
    );
  };

  return (
    <DashboardLayout role="admin" title="Disputes and review moderation" description="Permission-controlled queues for operational resolution and content moderation.">
      {error && <ErrorState message={error} onRetry={load} />}
      {notice && <div className="mb-5 flex gap-2 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18}/>{notice}</div>}
      <div className="mb-5 flex justify-end"><button type="button" disabled={busy} onClick={load} className="flex items-center gap-2 rounded border px-4 py-2 text-xs font-bold"><RefreshCw size={14}/>Refresh</button></div>
      {loading ? <LoadingState label="Loading moderation queues…"/> : <>
        <DashboardSection title={`Disputes (${disputes.length})`} description="Only employees with dispute-management permission can access this queue.">
          <div className="space-y-3">
            {disputes.length === 0 && <p className="text-sm text-slate-500">No disputes found.</p>}
            {disputes.map((item) => <article key={item.id} className="rounded border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-bold">{item.disputeReference}</h3><p className="mt-1 text-xs capitalize text-slate-500">{item.reason.replaceAll("_", " ")} · {item.status.replaceAll("_", " ")}</p><p className="mt-2 max-w-3xl text-xs leading-5 text-slate-700">{item.details}</p><p className="mt-2 text-[10px] text-slate-400">Order #{item.orderId} · {formatDateTime(item.createdAt)}</p></div>{["opened", "under_review"].includes(item.status) && <button disabled={busy} onClick={() => resolveDispute(item)} className="rounded bg-slate-900 px-4 py-2 text-xs font-bold text-white">Resolve</button>}</div></article>)}
          </div>
        </DashboardSection>
        <DashboardSection title={`Review reports (${reports.length})`} description="Hide, restore or dismiss reported review content with a recorded reason.">
          <div className="space-y-3">
            {reports.length === 0 && <p className="text-sm text-slate-500">No review reports found.</p>}
            {reports.map((item) => <article key={item.id} className="rounded border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 text-sm font-bold"><ShieldAlert size={16}/>Report #{item.id} · Review #{item.reviewId}</h3><p className="mt-1 text-xs capitalize text-slate-500">{item.reason.replaceAll("_", " ")} · {item.status.replaceAll("_", " ")}</p><p className="mt-2 text-xs text-slate-700">{item.details || "No additional details."}</p></div>{item.status === "pending" && <div className="flex gap-2"><button disabled={busy} onClick={() => moderateReport(item, "hide")} className="rounded bg-red-600 px-3 py-2 text-xs font-bold text-white">Hide review</button><button disabled={busy} onClick={() => moderateReport(item, "dismiss_report")} className="rounded border px-3 py-2 text-xs font-bold">Dismiss</button></div>}</div></article>)}
          </div>
        </DashboardSection>
      </>}
    </DashboardLayout>
  );
}
