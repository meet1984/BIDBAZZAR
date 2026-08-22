import React, { useCallback, useEffect, useState } from "react";
import { ClipboardList, ShieldCheck } from "lucide-react";
import { CategoryManagementSection } from "./CategoryManagementSection";
import { VerificationQueueSection } from "./VerificationQueueSection";
import { DashboardLayout, DashboardSection } from "../dashboard/DashboardLayout";
import { ErrorState, LoadingState } from "../components/AsyncState";
import api from "../lib/api";
import { errorMessage, formatDateTime } from "../lib/format";

function ListingQueue() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/listings", { params: { reviewStatus: "submitted" } });
      setItems(data.items || []);
      setError("");
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const review = async (id, decision) => {
    const reason = decision === "approve" ? "" : window.prompt("Review reason:", "");
    if (decision !== "approve" && !reason) return;
    try {
      await api.patch(`/admin/listings/${id}/review`, { decision, reason });
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  return (
    <DashboardSection title={`Listing review (${items.length})`} description="Submitted negotiated and multi-unit listings.">
      {error && <ErrorState message={error} onRetry={load} />}
      <div className="space-y-3">
        {!items.length && !error && <p className="text-sm text-slate-500">No submitted listings.</p>}
        {items.map((item) => (
          <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-4">
            <div>
              <h3 className="text-sm font-bold">{item.title}</h3>
              <p className="mt-1 text-xs text-slate-500">{item.listingReference} · {item.saleMode?.replaceAll("_", " ")}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => review(item.id, "approve")} className="rounded bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Approve</button>
              <button onClick={() => review(item.id, "request_changes")} className="rounded border px-3 py-2 text-xs font-bold">Request changes</button>
              <button onClick={() => review(item.id, "reject")} className="rounded bg-red-600 px-3 py-2 text-xs font-bold text-white">Reject</button>
            </div>
          </article>
        ))}
      </div>
    </DashboardSection>
  );
}

function SupportQueue() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/support/enquiries");
      setItems(data.items || data || []);
      setError("");
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = async (id, status) => {
    try {
      await api.patch(`/admin/support/enquiries/${id}/status`, { status });
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  const download = async (id) => {
    try {
      const response = await api.get(`/admin/support/enquiries/${id}/attachment`, { responseType: "blob" });
      const objectUrl = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `support-attachment-${id}`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  return (
    <DashboardSection title={`Support enquiries (${items.length})`} description="Private attachments remain behind the authorized download endpoint.">
      {error && <ErrorState message={error} onRetry={load} />}
      <div className="space-y-3">
        {!items.length && !error && <p className="text-sm text-slate-500">No support enquiries.</p>}
        {items.map((item) => (
          <article key={item.id} className="rounded border p-4">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">{item.reference} · {item.subject}</h3>
                <p className="mt-1 text-xs text-slate-500">{item.fullName} · {formatDateTime(item.createdAt)}</p>
                <p className="mt-2 text-xs text-slate-700">{item.message}</p>
              </div>
              <div className="flex items-center gap-2">
                {item.attachment && <button onClick={() => download(item.id)} className="rounded border px-3 py-2 text-xs font-bold">Download attachment</button>}
                <select value={item.status} onChange={(event) => update(item.id, event.target.value)} className="h-10 rounded border px-2 text-xs">
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
          </article>
        ))}
      </div>
    </DashboardSection>
  );
}

export default function AdminEmployeePortalPage() {
  const [permissions, setPermissions] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("");

  useEffect(() => {
    api.get("/admin/my-permissions")
      .then(({ data }) => {
        const list = data.data?.permissions || [];
        setPermissions(list);
        setTab(list.find((permission) => ["listing_review", "verification_review", "category_management", "support_management"].includes(permission)) || "");
      })
      .catch((requestError) => setError(errorMessage(requestError)));
  }, []);

  if (!permissions) {
    return <DashboardLayout role="admin" title="Employee portal" description="Loading assigned operational permissions.">{error ? <ErrorState message={error} /> : <LoadingState label="Loading permissions…" />}</DashboardLayout>;
  }

  const labels = {
    listing_review: "Listings",
    verification_review: "Verification",
    category_management: "Categories",
    support_management: "Support",
  };
  const localPermissions = permissions.filter((permission) => labels[permission]);

  return (
    <DashboardLayout role="admin" title="Employee portal" description="Only explicitly assigned operational capabilities are available.">
      <DashboardSection title="Assigned capabilities" description="A full administrator controls these permissions.">
        <div className="flex flex-wrap gap-2">
          {permissions.length === 0 && <p className="text-sm text-slate-500">No permissions are assigned. Contact a full administrator.</p>}
          {permissions.map((permission) => <span key={permission} className="rounded bg-blue-50 px-3 py-2 text-xs font-bold capitalize text-blue-800">{permission.replaceAll("_", " ")}</span>)}
        </div>
      </DashboardSection>
      <div className="mb-6 flex flex-wrap gap-2">
        {localPermissions.map((permission) => <button key={permission} onClick={() => setTab(permission)} className={`rounded px-4 py-2 text-xs font-bold ${tab === permission ? "bg-slate-900 text-white" : "border bg-white"}`}>{labels[permission]}</button>)}
        {permissions.includes("order_oversight") && <a href="/admin/orders" className="flex items-center gap-2 rounded border bg-white px-4 py-2 text-xs font-bold"><ClipboardList size={14}/>Orders</a>}
        {(permissions.includes("dispute_management") || permissions.includes("review_moderation")) && <a href="/admin/operations" className="flex items-center gap-2 rounded border bg-white px-4 py-2 text-xs font-bold"><ShieldCheck size={14}/>Moderation</a>}
      </div>
      {tab === "listing_review" && <ListingQueue />}
      {tab === "verification_review" && <VerificationQueueSection />}
      {tab === "category_management" && <CategoryManagementSection />}
      {tab === "support_management" && <SupportQueue />}
    </DashboardLayout>
  );
}
