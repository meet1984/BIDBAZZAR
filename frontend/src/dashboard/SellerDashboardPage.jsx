import React, { useCallback, useEffect, useState } from "react";
import {
  Boxes,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  LifeBuoy,
  Lock,
  Pencil,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";
import api from "../lib/api";
import { errorMessage, formatDateTime, formatCurrency } from "../lib/format";
import { EmptyState, ErrorState, Link, LoadingState, SupportComplaintModal, TicketTrackerModal, VerificationStatusBanner } from "../components";
import { DashboardLayout } from "./DashboardLayout";
import AuctionForm from "./AuctionForm";
import { SellerListingPreviewModal } from "./SellerListingPreviewModal";
import { SellerOffersModal } from "./SellerOffersModal";

function WorkflowStatusBadge({ status }) {
  const styles = {
    draft: "bg-slate-100 text-slate-700 border-slate-200",
    submitted: "bg-amber-50 text-amber-800 border-amber-200",
    under_review: "bg-amber-50 text-amber-800 border-amber-200",
    approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
    rejected: "bg-red-50 text-red-800 border-red-200",
    closed: "bg-slate-100 text-slate-500 border-slate-200",
    changes_requested: "bg-purple-50 text-purple-800 border-purple-200",
  };
  const labels = {
    draft: "Draft",
    submitted: "Submitted",
    under_review: "Under Review",
    approved: "Approved & Live",
    rejected: "Rejected",
    closed: "Closed",
    changes_requested: "Changes Requested",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider ${styles[status] || styles.draft
        }`}
    >
      {status === "approved" ? <CheckCircle2 size={12} /> : null}
      {status === "submitted" || status === "under_review" ? <Clock size={12} /> : null}
      {status === "changes_requested" ? <Sparkles size={12} className="text-purple-600" /> : null}
      {labels[status] || status}
    </span>
  );
}

function SaleModeBadge({ saleMode }) {
  if (saleMode === "multi_unit_offer") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
        <Boxes size={12} /> Multi-Unit
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
      <Tag size={12} /> Negotiated
    </span>
  );
}

export default function SellerDashboardPage() {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "support") return "support";
    }
    return "auctions";
  });

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tabId);
      window.history.replaceState(null, "", url.pathname + url.search);
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, []);

  const [state, setState] = useState({ loading: true, error: "", items: [] });
  const [activeFormAuction, setActiveFormAuction] = useState(null);
  const [previewListing, setPreviewListing] = useState(null);
  const [selectedOffersListing, setSelectedOffersListing] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionId, setActionId] = useState("");

  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [trackingTicket, setTrackingTicket] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [rejectionReason, setRejectionReason] = useState(null);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const { data } = await api.get("/seller/listings");
      setState({ loading: false, error: "", items: data.items || [] });
    } catch (error) {
      setState({ loading: false, error: errorMessage(error), items: [] });
    }
  }, []);

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const { data } = await api.get("/support/my-enquiries", { params: { role: "seller" } });
      setTickets(data.items || []);
    } catch {
      // Non-critical
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadTickets();
    api.get("/verification/status").then(({ data }) => {
      const vs = data.data || data;
      setVerificationStatus(vs.verificationStatus);
      setRejectionReason(vs.rejectionReason);
    }).catch(() => { });
  }, [load, loadTickets]);

  const [actionError, setActionError] = useState("");

  const handleAction = async (id, action) => {
    setActionId(id);
    setActionError("");
    try {
      if (action === "submit") {
        await api.post(`/seller/listings/${id}/submit`);
      } else if (action === "confirm") {
        await api.post(`/seller/listings/${id}/confirm`);
      } else if (action === "delete") {
        if (window.confirm("Are you sure you want to delete this listing draft?")) {
          await api.delete(`/seller/listings/${id}`);
        } else {
          setActionId("");
          return;
        }
      }
      await load();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setActionId("");
    }
  };

  const filteredItems = state.items.filter((item) => {
    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "submitted"
          ? item.reviewStatus === "submitted" || item.reviewStatus === "under_review"
          : item.reviewStatus === statusFilter;

    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.listingReference && item.listingReference.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesSearch;
  });

  return (
    <DashboardLayout
      role="seller"
      title="Seller Workspace"
      description="Manage your marketplace listings, review admin feedback, and track support requests."
      activeTab={activeTab}
      onSelectTab={handleTabChange}
    >
      <div className="space-y-6">
        <VerificationStatusBanner
          accountType="seller"
          verificationStatus={verificationStatus}
          rejectionReason={rejectionReason}
        />

        {actionError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 font-semibold flex items-center justify-between">
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError("")} className="font-bold text-red-500 hover:text-red-800 ml-2">✕</button>
          </div>
        )}

        {/* Tab Header */}
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => handleTabChange("auctions")}
            className={`border-b-2 px-6 py-3 text-sm font-bold transition ${activeTab === "auctions"
              ? "border-[#2563eb] text-[#2563eb]"
              : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
          >
            My Listings & Lots ({state.items.length})
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("support")}
            className={`border-b-2 px-6 py-3 text-sm font-bold transition ${activeTab === "support"
              ? "border-[#2563eb] text-[#2563eb]"
              : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
          >
            Support Tickets ({tickets.length})
          </button>
        </div>

        {activeTab === "auctions" && (
          <div className="space-y-4">
            {/* Filter and Action Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search listings..."
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs outline-none focus:border-[#2563eb]"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">Drafts</option>
                  <option value="approved">Approved & Live</option>
                  <option value="closed">Closed / Completed</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/seller/orders"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
                >
                  <ShoppingBag size={15} className="text-slate-500" /> Orders & Deals
                </Link>

                {verificationStatus === "verified" ? (
                  <button
                    type="button"
                    onClick={() => setActiveFormAuction({})}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
                  >
                    <Plus size={16} /> Create New Listing
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    <Lock size={14} /> Verification Required to List
                  </div>
                )}
              </div>
            </div>

            {/* Informational Visibility Notice */}
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900 leading-relaxed">
              <span className="font-bold block text-blue-950 mb-0.5">📌 Direct Listing Publishing:</span>
              As a verified seller, you can create and publish listings directly without waiting for admin auction approval. Choose your starting date & time, ensure your listing duration is at least 48 hours, and your lot will be immediately live or scheduled for its start time.
            </div>

            {/* Content Table */}
            {state.loading ? (
              <LoadingState label="Loading seller listings..." />
            ) : state.error ? (
              <ErrorState message={state.error} onRetry={load} />
            ) : filteredItems.length === 0 ? (
              <EmptyState title="No Listings Found" description="You have not created any listings matching your filter criteria." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3.5">Listing & Lot Ref</th>
                      <th className="px-4 py-3.5">Category</th>
                      <th className="px-4 py-3.5">Sale Mode</th>
                      <th className="px-4 py-3.5">Asking Price</th>
                      <th className="px-4 py-3.5">Review Status</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-[#0f172a]">{item.title}</div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {item.listingReference || `LOT-${item.id}`}
                          </div>
                          {item.reviewNotes && (
                            <div className="mt-1 max-w-md rounded bg-purple-50 p-1.5 text-[11px] text-purple-900 border border-purple-100">
                              <span className="font-bold">Admin Note:</span> {item.reviewNotes}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div>{item.category?.name || "General"}</div>
                          {item.subcategory?.name && (
                            <div className="text-[11px] text-slate-400">{item.subcategory.name}</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <SaleModeBadge saleMode={item.saleMode} />
                        </td>
                        <td className="px-4 py-3.5 font-bold text-[#0f172a]">
                          {item.saleMode === "multi_unit_offer"
                            ? `${formatCurrency(item.askingPricePerUnit || 0)} / ${item.unitName || "unit"}`
                            : formatCurrency(item.askingPrice || 0)}
                        </td>
                        <td className="px-4 py-3.5">
                          <WorkflowStatusBadge status={item.reviewStatus} />
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Preview Modal Trigger */}
                            <button
                              type="button"
                              onClick={() => setPreviewListing(item)}
                              className="rounded p-1.5 text-[#2563eb] hover:bg-blue-50"
                              title="Preview Listing"
                            >
                              <Eye size={15} />
                            </button>

                            {/* View Offers Button */}
                            {["approved", "scheduled", "open", "offer_selection", "sold"].includes(item.reviewStatus) && (
                              <button
                                type="button"
                                onClick={() => setSelectedOffersListing(item)}
                                className="inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
                                title="Manage Received Offers"
                              >
                                <Tag size={13} /> Offers
                              </button>
                            )}

                            {/* View Public Listing Link */}
                            {["approved", "scheduled", "open"].includes(item.reviewStatus) && (
                              <a
                                href={`/auctions/${item.publicSlug || item.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                title="Open Live Public Page"
                              >
                                <ExternalLink size={15} />
                              </a>
                            )}

                            {/* Edit Button */}
                            {item.reviewStatus !== "completed" && (
                              <button
                                type="button"
                                onClick={() => setActiveFormAuction(item)}
                                className="rounded p-1.5 text-blue-600 hover:bg-blue-50"
                                title="Edit Listing"
                              >
                                <Pencil size={15} />
                              </button>
                            )}

                            {/* Publish Listing */}
                            {item.reviewStatus === "draft" && (
                              <button
                                type="button"
                                disabled={actionId === item.id}
                                onClick={() => handleAction(item.id, "submit")}
                                className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"
                                title="Publish Listing Now"
                              >
                                <Send size={15} />
                              </button>
                            )}

                            {/* Delete Draft */}
                            {item.reviewStatus === "draft" && (
                              <button
                                type="button"
                                disabled={actionId === item.id}
                                onClick={() => handleAction(item.id, "delete")}
                                className="rounded p-1.5 text-red-600 hover:bg-red-50"
                                title="Delete Draft Listing"
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
            )}
          </div>
        )}

        {activeTab === "support" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowComplaintModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
              >
                <LifeBuoy size={16} /> Submit Support Enquiry
              </button>
            </div>
            {ticketsLoading ? (
              <LoadingState label="Loading support tickets..." />
            ) : tickets.length === 0 ? (
              <EmptyState title="No Support Tickets" description="You have not submitted any support tickets yet." />
            ) : (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {tickets.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-4 text-xs">
                    <div>
                      <span className="font-mono font-bold text-[#2563eb]">{t.reference || t.referenceNumber}</span>
                      <div className="font-bold text-slate-800">{t.subject}</div>
                      <div className="text-slate-400">{formatDateTime(t.createdAt)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTrackingTicket(t)}
                      className="rounded border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Track Ticket
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Form */}
      {activeFormAuction && (
        <AuctionForm
          listing={activeFormAuction.id ? activeFormAuction : null}
          onClose={() => setActiveFormAuction(null)}
          onSuccess={() => {
            setActiveFormAuction(null);
            void load();
          }}
        />
      )}

      {showComplaintModal && (
        <SupportComplaintModal
          accountType="seller"
          onClose={() => setShowComplaintModal(false)}
          onSuccess={() => {
            setShowComplaintModal(false);
            void loadTickets();
          }}
        />
      )}

      {trackingTicket && (
        <TicketTrackerModal
          ticket={trackingTicket}
          onClose={() => setTrackingTicket(null)}
        />
      )}

      {previewListing && (
        <SellerListingPreviewModal
          listing={previewListing}
          onClose={() => setPreviewListing(null)}
          onEdit={(item) => setActiveFormAuction(item)}
        />
      )}

      {selectedOffersListing && (
        <SellerOffersModal
          listing={selectedOffersListing}
          isOpen={Boolean(selectedOffersListing)}
          onClose={() => setSelectedOffersListing(null)}
          onRefresh={load}
        />
      )}
    </DashboardLayout>
  );
}
