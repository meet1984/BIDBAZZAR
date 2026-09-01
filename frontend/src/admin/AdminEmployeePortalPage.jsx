import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  ClipboardList,
  FolderTree,
  Layers,
  LifeBuoy,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Star,
  UserCheck,
} from "lucide-react";
import { CategoryManagementSection } from "./CategoryManagementSection";
import { VerificationQueueSection } from "./VerificationQueueSection";
import { DashboardLayout, DashboardSection } from "../dashboard/DashboardLayout";
import { ErrorState, LoadingState } from "../components/AsyncState";
import api from "../lib/api";
import { errorMessage, formatCurrency, formatDateTime } from "../lib/format";

const CAPABILITY_CONFIG = {
  listing_review: {
    key: "listing_review",
    label: "Listing Review",
    shortLabel: "Listings",
    icon: Layers,
    description: "Review and approve/reject marketplace auction listings",
  },
  verification_review: {
    key: "verification_review",
    label: "Verification Queue",
    shortLabel: "Verification",
    icon: UserCheck,
    description: "Review buyer and seller KYC identity submissions",
  },
  category_management: {
    key: "category_management",
    label: "Category Management",
    shortLabel: "Categories",
    icon: FolderTree,
    description: "Manage platform product categories and commission tiers",
  },
  support_management: {
    key: "support_management",
    label: "Support Enquiries",
    shortLabel: "Support",
    icon: LifeBuoy,
    description: "Manage and resolve user support inquiries and tickets",
  },
  order_oversight: {
    key: "order_oversight",
    label: "Order Oversight",
    shortLabel: "Orders",
    icon: ClipboardList,
    description: "Oversight and tracking for all marketplace orders",
  },
  dispute_management: {
    key: "dispute_management",
    label: "Dispute Management",
    shortLabel: "Disputes",
    icon: ShieldAlert,
    description: "Audit and resolve transaction disputes and settlements",
  },
  review_moderation: {
    key: "review_moderation",
    label: "Review Moderation",
    shortLabel: "Reviews",
    icon: Star,
    description: "Moderate user ratings and reported marketplace reviews",
  },
};

/* -------------------------------------------------------------------------- */
/* 1. LISTING REVIEW QUEUE                                                   */
/* -------------------------------------------------------------------------- */
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

  useEffect(() => {
    load();
  }, [load]);

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
    <DashboardSection
      title={`Listing Review Queue (${items.length})`}
      description="Submitted auctions, negotiated lots, and multi-unit marketplace listings awaiting administrative approval."
    >
      {error && <ErrorState message={error} onRetry={load} />}
      <div className="space-y-3">
        {!items.length && !error && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
            <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
            <p className="text-sm font-bold text-slate-700">All listings reviewed</p>
            <p className="text-xs text-slate-500 mt-1">There are no submitted listings pending moderation at this time.</p>
          </div>
        )}
        {items.map((item) => (
          <article
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 transition"
          >
            <div>
              <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
              <p className="mt-1 text-xs text-slate-500">
                <span className="font-mono font-bold text-slate-700">{item.listingReference}</span> · {item.saleMode?.replaceAll("_", " ")}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => review(item.id, "approve")}
                className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
              >
                Approve
              </button>
              <button
                onClick={() => review(item.id, "request_changes")}
                className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Request Changes
              </button>
              <button
                onClick={() => review(item.id, "reject")}
                className="rounded-lg bg-red-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </article>
        ))}
      </div>
    </DashboardSection>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. SUPPORT ENQUIRIES QUEUE                                                */
/* -------------------------------------------------------------------------- */
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

  useEffect(() => {
    load();
  }, [load]);

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
    <DashboardSection
      title={`Support Enquiries (${items.length})`}
      description="Private tickets and inquiries submitted by marketplace buyers and sellers."
    >
      {error && <ErrorState message={error} onRetry={load} />}
      <div className="space-y-3">
        {!items.length && !error && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
            <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
            <p className="text-sm font-bold text-slate-700">Support queue is clear</p>
            <p className="text-xs text-slate-500 mt-1">No open customer support inquiries at this time.</p>
          </div>
        )}
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                    {item.reference}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">{item.subject}</h3>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  From: <span className="font-semibold text-slate-700">{item.fullName}</span> · {formatDateTime(item.createdAt)}
                </p>
                <p className="mt-3 text-xs leading-relaxed text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-100">
                  {item.message}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                {item.attachment && (
                  <button
                    onClick={() => download(item.id)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Download Attachment
                  </button>
                )}
                <select
                  value={item.status}
                  onChange={(event) => update(item.id, event.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold outline-none focus:border-[#2563eb]"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
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

/* -------------------------------------------------------------------------- */
/* 3. ORDER OVERSIGHT QUEUE                                                  */
/* -------------------------------------------------------------------------- */
function OrderOversightQueue() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/orders/admin");
      const items = data.data || [];
      setOrders(items);
      if (items.length > 0 && !selectedOrder) {
        setSelectedOrder(items[0]);
      }
    } catch (err) {
      setError(errorMessage(err, "Failed to load orders for oversight."));
    } finally {
      setLoading(false);
    }
  }, [selectedOrder]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = statusFilter === "all" || order.orderStatus === statusFilter;
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      order.orderReference?.toLowerCase().includes(q) ||
      order.listingDetails?.title?.toLowerCase().includes(q) ||
      order.buyerDetails?.name?.toLowerCase().includes(q) ||
      order.sellerDetails?.name?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <DashboardSection
      title={`Order Oversight (${orders.length})`}
      description="Full operational visibility into confirmed deals, settlement statuses, and parties across the marketplace."
    >
      {error && <ErrorState message={error} onRetry={load} />}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search reference, title, parties…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-64 rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs outline-none focus:border-[#2563eb]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold outline-none focus:border-[#2563eb]"
          >
            <option value="all">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {loading ? (
        <LoadingState label="Loading orders for oversight…" />
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <ClipboardList size={32} className="mx-auto text-slate-400 mb-2" />
          <p className="text-sm font-bold text-slate-700">No orders found</p>
          <p className="text-xs text-slate-500 mt-1">No orders matching the current search or status filter.</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredOrders.map((order) => {
              const isSelected = selectedOrder?.id === order.id;
              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrder(order)}
                  className={`w-full rounded-xl border p-3.5 text-left transition ${
                    isSelected
                      ? "border-[#2563eb] bg-blue-50/60 shadow-xs ring-1 ring-[#2563eb]"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-slate-800">{order.orderReference}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                        order.orderStatus === "completed"
                          ? "bg-emerald-100 text-emerald-800"
                          : order.orderStatus === "cancelled"
                          ? "bg-red-100 text-red-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {order.orderStatus}
                    </span>
                  </div>
                  <p className="mt-1.5 truncate text-xs font-bold text-slate-900">
                    {order.listingDetails?.title || "Marketplace Deal"}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="font-extrabold text-[#2563eb]">{formatCurrency(order.totalAmount, order.currency)}</span>
                    <span className="text-[11px] text-slate-400">{formatDateTime(order.createdAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedOrder && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              {selectedOrder.orderStatus === "cancelled" && (
                <div className="relative overflow-hidden rounded-xl border-2 border-red-300 bg-gradient-to-br from-red-50 via-rose-50 to-red-100/70 p-4 shadow-xs">
                  <div className="pointer-events-none absolute right-2 -bottom-3 select-none font-black text-6xl tracking-widest text-red-500/10 uppercase rotate-[-5deg]">
                    CANCELLED
                  </div>
                  <div className="relative z-10 flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-600 text-white shadow-xs">
                      <Ban size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-black uppercase text-white">
                          DEAL CANCELLED
                        </span>
                        <span className="text-xs font-mono font-bold text-red-700">
                          {selectedOrder.orderReference}
                        </span>
                      </div>
                      <h4 className="mt-1 text-base font-black text-red-950">
                        This Deal Was Cancelled
                      </h4>
                      <p className="mt-0.5 text-xs text-red-900/80 leading-relaxed">
                        Transaction terminated. Direct arrangement between buyer and seller was cancelled.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Deal {selectedOrder.orderReference}</h3>
                  <p className="text-xs text-slate-500">Confirmed on {formatDateTime(selectedOrder.createdAt)}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase ${
                    selectedOrder.orderStatus === "completed"
                      ? "bg-emerald-100 text-emerald-800"
                      : selectedOrder.orderStatus === "cancelled"
                      ? "bg-red-600 text-white shadow-2xs"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {selectedOrder.orderStatus}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3.5 border border-slate-100 text-center">
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Quantity</p>
                  <p className="mt-0.5 text-xs font-extrabold text-slate-900">{selectedOrder.quantity || 1} units</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Unit Price</p>
                  <p className="mt-0.5 text-xs font-extrabold text-slate-900">
                    {formatCurrency(selectedOrder.unitPrice, selectedOrder.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Total Value</p>
                  <p className="mt-0.5 text-xs font-extrabold text-[#2563eb]">
                    {formatCurrency(selectedOrder.totalAmount, selectedOrder.currency)}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-3.5 bg-white">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Buyer Information</p>
                  <p className="mt-1 text-xs font-bold text-slate-900">
                    {selectedOrder.buyerDetails?.legalFullName || selectedOrder.buyerDetails?.fullName || selectedOrder.buyerDetails?.name || "Buyer"}
                  </p>
                  <p className="text-[11px] text-slate-500">{selectedOrder.buyerDetails?.email || "Email unlisted"}</p>
                  <p className="text-[11px] text-slate-500">{selectedOrder.buyerDetails?.phone || "Phone unlisted"}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3.5 bg-white">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700">Seller Information</p>
                  <p className="mt-1 text-xs font-bold text-slate-900">
                    {selectedOrder.sellerDetails?.sellerName || selectedOrder.sellerDetails?.legalName || selectedOrder.sellerDetails?.fullName || selectedOrder.sellerDetails?.name || "Seller"}
                  </p>
                  <p className="text-[11px] text-slate-500">{selectedOrder.sellerDetails?.email || "Email unlisted"}</p>
                  <p className="text-[11px] text-slate-500">{selectedOrder.sellerDetails?.phone || "Phone unlisted"}</p>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600 border border-slate-100 space-y-1">
                <p>
                  <strong>Buyer Confirmation:</strong>{" "}
                  {selectedOrder.buyerCompletedAt ? formatDateTime(selectedOrder.buyerCompletedAt) : "Pending"}
                </p>
                <p>
                  <strong>Seller Confirmation:</strong>{" "}
                  {selectedOrder.sellerCompletedAt ? formatDateTime(selectedOrder.sellerCompletedAt) : "Pending"}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardSection>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. DISPUTE MANAGEMENT QUEUE                                               */
/* -------------------------------------------------------------------------- */
function DisputeManagementQueue() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/disputes/admin?limit=100&offset=0");
      setDisputes(data.data || []);
    } catch (err) {
      setError(errorMessage(err, "Failed to load disputes queue."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resolveDispute = async (dispute) => {
    const disputeOutcomes = ["resolved_buyer_favour", "resolved_seller_favour", "resolved_compromise", "closed"];
    const resolutionOutcome = window.prompt(`Outcome: ${disputeOutcomes.join(", ")}`, "resolved_compromise");
    if (!resolutionOutcome || !disputeOutcomes.includes(resolutionOutcome)) return;
    const resolutionNotes = window.prompt("Audited resolution notes (at least 10 characters):", "");
    if (!resolutionNotes || resolutionNotes.trim().length < 10) {
      alert("Resolution notes must be at least 10 characters.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.post(`/disputes/${dispute.id}/resolve`, {
        resolutionOutcome,
        resolutionNotes: resolutionNotes.trim(),
      });
      setNotice(`Dispute ${dispute.disputeReference} successfully resolved (${resolutionOutcome}).`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const filtered = disputes.filter((d) => statusFilter === "all" || d.status === statusFilter);

  return (
    <DashboardSection
      title={`Dispute Management Queue (${disputes.length})`}
      description="Audit, mediate, and record binding administrative resolutions for marketplace transaction disputes."
    >
      {error && <ErrorState message={error} onRetry={load} />}
      {notice && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
          <CheckCircle2 size={16} />
          {notice}
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold outline-none focus:border-[#2563eb]"
          >
            <option value="all">All Dispute Statuses</option>
            <option value="opened">Opened / Pending</option>
            <option value="under_review">Under Review</option>
            <option value="resolved_buyer_favour">Resolved (Buyer Favor)</option>
            <option value="resolved_seller_favour">Resolved (Seller Favor)</option>
            <option value="resolved_compromise">Resolved (Compromise)</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <button
          onClick={load}
          disabled={busy || loading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {loading ? (
        <LoadingState label="Loading dispute records…" />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <ShieldAlert size={32} className="mx-auto text-slate-400 mb-2" />
          <p className="text-sm font-bold text-slate-700">No disputes found</p>
          <p className="text-xs text-slate-500 mt-1">There are no disputes matching the selected filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">{item.disputeReference}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                        ["opened", "under_review"].includes(item.status)
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {item.status?.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-600">
                    Reason: <span className="capitalize text-slate-900">{item.reason?.replaceAll("_", " ")}</span> · Order #{item.orderId}
                  </p>
                </div>
                {["opened", "under_review"].includes(item.status) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => resolveDispute(item)}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    Resolve Dispute
                  </button>
                )}
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100 text-xs text-slate-700 leading-relaxed">
                <p className="font-bold text-slate-900 mb-0.5">Dispute Details:</p>
                {item.details || "No additional dispute details provided."}
              </div>
              <p className="text-[10px] text-slate-400">Logged on {formatDateTime(item.createdAt)}</p>
            </article>
          ))}
        </div>
      )}
    </DashboardSection>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. REVIEW MODERATION QUEUE                                                */
/* -------------------------------------------------------------------------- */
function ReviewModerationQueue() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/reviews/reports/admin");
      setReports(data.data || []);
    } catch (err) {
      setError(errorMessage(err, "Failed to load reported reviews."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const moderateReport = async (report, action) => {
    const moderationReason = window.prompt("Moderation reason (at least 5 characters):", "");
    if (!moderationReason || moderationReason.trim().length < 5) {
      alert("Please provide a reason of at least 5 characters.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.post(`/reviews/${report.reviewId}/moderate`, {
        action,
        moderationReason: moderationReason.trim(),
        reportId: report.id,
      });
      setNotice(`Review report #${report.id} processed (${action}).`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardSection
      title={`Review Moderation Queue (${reports.length})`}
      description="Review reported buyer/seller ratings, hide inappropriate or misleading content, or dismiss false flags."
    >
      {error && <ErrorState message={error} onRetry={load} />}
      {notice && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
          <CheckCircle2 size={16} />
          {notice}
        </div>
      )}

      <div className="mb-5 flex justify-end">
        <button
          onClick={load}
          disabled={busy || loading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {loading ? (
        <LoadingState label="Loading review moderation queue…" />
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <Star size={32} className="mx-auto text-emerald-500 mb-2" />
          <p className="text-sm font-bold text-slate-700">No reported reviews</p>
          <p className="text-xs text-slate-500 mt-1">All user feedback and marketplace ratings are currently in good standing.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">Report #{item.id}</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                      Review #{item.reviewId}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                        item.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-600">
                    Reason: <span className="capitalize text-slate-900">{item.reason?.replaceAll("_", " ")}</span>
                  </p>
                </div>
                {item.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      onClick={() => moderateReport(item, "hide")}
                      className="rounded-lg bg-red-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                    >
                      Hide Review
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => moderateReport(item, "dismiss_report")}
                      className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      Dismiss Report
                    </button>
                  </div>
                )}
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100 text-xs text-slate-700 leading-relaxed">
                <p className="font-bold text-slate-900 mb-0.5">Report Description:</p>
                {item.details || "No additional report description provided."}
              </div>
            </article>
          ))}
        </div>
      )}
    </DashboardSection>
  );
}

/* -------------------------------------------------------------------------- */
/* MAIN COMPONENT: ADMIN EMPLOYEE PORTAL PAGE                                */
/* -------------------------------------------------------------------------- */
export default function AdminEmployeePortalPage() {
  const [permissions, setPermissions] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("");

  useEffect(() => {
    api
      .get("/admin/my-permissions")
      .then(({ data }) => {
        const list = data.data?.permissions || [];
        setPermissions(list);
        setTab(
          list.find((permission) =>
            [
              "listing_review",
              "verification_review",
              "category_management",
              "support_management",
              "order_oversight",
              "dispute_management",
              "review_moderation",
            ].includes(permission),
          ) || "",
        );
      })
      .catch((requestError) => setError(errorMessage(requestError)));
  }, []);

  const handleTabChange = (tabKey) => {
    setTab(tabKey);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  };

  if (!permissions) {
    return (
      <DashboardLayout role="admin" title="Employee Operations Portal" description="Loading assigned operational capabilities.">
        {error ? <ErrorState message={error} /> : <LoadingState label="Loading capabilities…" />}
      </DashboardLayout>
    );
  }

  const sidebarExtraNav = (
    <div className="pt-3 border-t border-slate-100 mt-3">
      <div className="flex items-center justify-between px-3 pb-2.5">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          Assigned Capabilities
        </p>
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-extrabold text-[#2563eb]">
          {permissions.length}
        </span>
      </div>

      {permissions.length === 0 ? (
        <div className="mx-1 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-800">
          <p className="font-semibold">No capabilities assigned.</p>
          <p className="mt-0.5 text-slate-500">Contact a platform administrator.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {permissions.map((permKey) => {
            const config = CAPABILITY_CONFIG[permKey] || {
              key: permKey,
              label: permKey.replaceAll("_", " "),
              shortLabel: permKey,
              icon: Shield,
            };
            const Icon = config.icon;
            const isActive = tab === config.key;

            return (
              <button
                key={config.key}
                type="button"
                onClick={() => handleTabChange(config.key)}
                className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-bold transition-all text-left ${
                  isActive
                    ? "bg-[#0f172a] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon size={15} className={isActive ? "text-blue-400" : "text-slate-400"} />
                  <span className="truncate">{config.label}</span>
                </span>
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    isActive ? "bg-blue-400 ring-2 ring-blue-400/30" : "bg-emerald-500"
                  }`}
                  title="Active Capability"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout
      role="admin"
      title="Employee Operations Portal"
      description="Only explicitly assigned operational capabilities are available to your account."
      sidebarExtra={sidebarExtraNav}
    >
      {/* Assigned Capabilities Summary Cards */}
      <DashboardSection
        title="Assigned Operational Capabilities"
        description="Select any capability below or in the left sidebar to access its operational queue directly."
      >
        {permissions.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-800">
            <p className="font-bold flex items-center gap-1.5">
              <AlertCircle size={15} /> No operational capabilities assigned
            </p>
            <p className="mt-1 text-slate-600">
              Please contact a platform administrator to grant access to listings, verification, categories, support, orders, disputes, or reviews.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {permissions.map((permKey) => {
              const config = CAPABILITY_CONFIG[permKey] || {
                key: permKey,
                label: permKey.replaceAll("_", " "),
                shortLabel: permKey,
                icon: Shield,
                description: "Administrative access granted",
              };
              const Icon = config.icon;
              const isActive = tab === config.key;

              return (
                <button
                  key={config.key}
                  type="button"
                  onClick={() => handleTabChange(config.key)}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    isActive
                      ? "border-[#2563eb] bg-blue-50/50 shadow-xs ring-1 ring-[#2563eb]"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`p-2 rounded-lg ${
                          isActive ? "bg-[#2563eb] text-white" : "bg-blue-50 text-[#2563eb]"
                        }`}
                      >
                        <Icon size={16} />
                      </span>
                      <h4 className="text-xs font-bold text-slate-900">{config.label}</h4>
                    </div>
                    <span className="rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-extrabold border border-emerald-200/60">
                      Active
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500 leading-snug">{config.description}</p>
                </button>
              );
            })}
          </div>
        )}
      </DashboardSection>

      {/* Tabs Navigation for Queues */}
      {permissions.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
          {permissions.map((permKey) => {
            const config = CAPABILITY_CONFIG[permKey] || {
              key: permKey,
              label: permKey.replaceAll("_", " "),
              shortLabel: permKey,
              icon: Shield,
            };
            const Icon = config.icon;
            const isActive = tab === permKey;
            return (
              <button
                key={permKey}
                type="button"
                onClick={() => handleTabChange(permKey)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all ${
                  isActive
                    ? "bg-[#0f172a] text-white shadow-xs"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon size={15} className={isActive ? "text-blue-400" : "text-slate-500"} />
                {config.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Queue View Rendering In-Place Without Page Switch */}
      {tab === "listing_review" && <ListingQueue />}
      {tab === "verification_review" && <VerificationQueueSection />}
      {tab === "category_management" && <CategoryManagementSection />}
      {tab === "support_management" && <SupportQueue />}
      {tab === "order_oversight" && <OrderOversightQueue />}
      {tab === "dispute_management" && <DisputeManagementQueue />}
      {tab === "review_moderation" && <ReviewModerationQueue />}
    </DashboardLayout>
  );
}
