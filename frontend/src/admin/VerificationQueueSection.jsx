import React, { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  Search,
  Shield,
} from "lucide-react";
import api from "../lib/api";
import { errorMessage, formatDateTime } from "../lib/format";
import { EmptyState, LoadingState } from "../components";
import { VerificationReviewModal } from "./VerificationReviewModal";

function StatusBadge({ status }) {
  const styles = {
    profile_incomplete: "bg-amber-50 text-amber-800 border-amber-200",
    draft: "bg-slate-100 text-slate-700 border-slate-200",
    submitted: "bg-blue-50 text-blue-800 border-blue-200 font-extrabold",
    under_review: "bg-blue-100 text-blue-900 border-blue-300 font-extrabold",
    verified: "bg-emerald-50 text-emerald-800 border-emerald-200 font-extrabold",
    changes_requested: "bg-purple-50 text-purple-800 border-purple-200",
    rejected: "bg-red-50 text-red-800 border-red-200",
    suspended: "bg-red-100 text-red-900 border-red-300 font-extrabold",
  };

  const labels = {
    profile_incomplete: "Incomplete",
    draft: "Draft",
    submitted: "Submitted",
    under_review: "Under Review",
    verified: "Verified",
    changes_requested: "Changes Requested",
    rejected: "Rejected",
    suspended: "Suspended",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wider ${styles[status] || styles.draft
        }`}
    >
      {status === "verified" ? <CheckCircle2 size={11} /> : null}
      {status === "submitted" || status === "under_review" ? <Clock size={11} /> : null}
      {labels[status] || status}
    </span>
  );
}

export function VerificationQueueSection() {
  const [accountType, setAccountType] = useState("buyer"); // 'buyer' | 'seller'
  const [statusFilter, setStatusFilter] = useState("all"); // show all items by default
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState({ items: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedTarget, setSelectedTarget] = useState(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const endpoint = accountType === "buyer" ? "/admin/verification/buyers" : "/admin/verification/sellers";
      const params = {
        page,
        pageSize: 15,
        status: statusFilter !== "all" ? statusFilter : undefined,
        q: searchQuery.trim() || undefined,
      };

      const res = await api.get(endpoint, { params });
      const body = res.data.data || res.data;
      setData({
        items: body.items || [],
        total: body.total || 0,
        totalPages: body.totalPages || 1,
      });
    } catch (err) {
      setError(errorMessage(err, "Failed to load verification queue."));
    } finally {
      setLoading(false);
    }
  }, [accountType, statusFilter, searchQuery, page]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const handleOpenReview = (item) => {
    setSelectedTarget(item);
    setIsReviewOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-xl font-black text-[#0f172a] flex items-center gap-2">
              <Shield size={20} className="text-[#2563eb]" /> Verification Moderation Queue
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Review submitted buyer and seller profiles, inspect uploaded identity documents, and grant verification status.
            </p>
          </div>

          {/* Account Type Toggle */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 shrink-0">
            <button
              type="button"
              onClick={() => { setAccountType("buyer"); setPage(1); }}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${accountType === "buyer"
                  ? "bg-white text-[#2563eb] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
                }`}
            >
              Buyer Queue
            </button>
            <button
              type="button"
              onClick={() => { setAccountType("seller"); setPage(1); }}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${accountType === "seller"
                  ? "bg-white text-[#2563eb] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
                }`}
            >
              Seller Queue
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder={`Search ${accountType} by name or email...`}
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3.5 py-2 text-xs text-[#0f172a] placeholder:text-slate-400 focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 transition-all outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-600">Filter Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#0f172a] focus:border-[#2563eb] outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted (Awaiting Review)</option>
              <option value="under_review">Under Review</option>
              <option value="verified">Verified</option>
              <option value="changes_requested">Changes Requested</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
              <option value="profile_incomplete">Profile Incomplete</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Data */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8">
            <LoadingState label="Loading verification queue..." />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-red-600 font-bold">{error}</div>
        ) : data.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Account ID</th>
                  <th className="px-5 py-3.5">Full / Legal Name</th>
                  <th className="px-5 py-3.5">Email</th>
                  <th className="px-5 py-3.5">Verification Status</th>
                  <th className="px-5 py-3.5">Submitted Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((item) => (
                  <tr key={item.accountId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-[#2563eb]">#{item.accountId}</td>
                    <td className="px-5 py-4 font-extrabold text-[#0f172a]">{item.fullName}</td>
                    <td className="px-5 py-4 text-slate-600">{item.email}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={item.verificationStatus} />
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {item.verificationSubmittedAt ? formatDateTime(item.verificationSubmittedAt) : "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenReview(item)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#2563eb] hover:bg-blue-50 transition-colors shadow-2xs"
                      >
                        <Eye size={14} /> Review Profile & Docs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8">
            <EmptyState
              title={`No ${accountType} verifications found`}
              description="There are currently no verification queue items matching your active search and status filter."
            />
          </div>
        )}

        {/* Pagination Footer */}
        {data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 bg-slate-50/50">
            <p className="text-xs text-slate-500 font-medium">
              Showing page {data.page} of {data.totalPages} ({data.total} total items)
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={data.page <= 1}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={data.page >= data.totalPages}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Verification Review Modal */}
      <VerificationReviewModal
        target={selectedTarget}
        isOpen={isReviewOpen}
        onClose={() => { setIsReviewOpen(false); setSelectedTarget(null); }}
        onActionSuccess={loadQueue}
      />
    </div>
  );
}
