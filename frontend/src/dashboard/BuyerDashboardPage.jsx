import React, { useCallback, useEffect, useState } from "react";
import { Ban, CheckCircle2, Clock, Eye, LifeBuoy, Plus, ShoppingBag } from "lucide-react";
import api from "../lib/api";
import { errorMessage, formatDateTime, formatINR } from "../lib/format";
import { EmptyState, ErrorState, Link, LoadingState, SupportComplaintModal, TicketTrackerModal, VerificationStatusBanner } from "../components";
import { DashboardLayout, DashboardSection } from "./DashboardLayout";
import { useAuth } from "../auth/AuthContext";

function AuctionRows({ items }) {
  if (!items || !items.length) return null;
  return (
    <div className="divide-y divide-slate-200">
      {items.map((item) => (
        <div key={item.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold">{item.title}</p>
            <p className="mt-1 text-xs text-slate-500">
              Asking Price: {formatINR(item.askingPrice || item.startPrice || 0)}
            </p>
          </div>
          <Link href={`/auctions/${item.publicSlug || item.id}`} className="text-xs font-bold text-[#2563eb]">
            View listing
          </Link>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    open: "bg-blue-100 text-[#2563eb] border-blue-200",
    in_progress: "bg-amber-100 text-amber-800 border-amber-200",
    resolved: "bg-emerald-100 text-emerald-800 border-emerald-200",
    closed: "bg-slate-100 text-slate-700 border-slate-200",
  };
  const labels = {
    open: "Open",
    in_progress: "In Progress",
    resolved: "Resolved",
    closed: "Closed",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${styles[status] || styles.open}`}>
      {status === "resolved" ? <CheckCircle2 size={11} /> : <Clock size={11} />}
      {labels[status] || status}
    </span>
  );
}

function BuyerOfferRows({ offers, onRefresh }) {
  const [activeId, setActiveId] = useState(null);
  const [reviseOfferObj, setReviseOfferObj] = useState(null);
  const [reviseAmount, setReviseAmount] = useState("");
  const [reviseMessage, setReviseMessage] = useState("");
  const [reviseSubmitting, setReviseSubmitting] = useState(false);

  if (!offers || !offers.length) return null;

  const handleAction = async (id, action, allocId) => {
    setActiveId(id);
    try {
      if (action === "confirm") {
        await api.post(`/offers/${id}/buyer-confirm`);
      } else if (action === "confirmMulti") {
        await api.post(`/multi-unit-offers/allocations/${allocId}/confirm`);
      } else if (action === "decline") {
        if (window.confirm("Are you sure you want to decline this accepted offer?")) {
          await api.post(`/offers/${id}/buyer-decline`);
        } else {
          setActiveId(null);
          return;
        }
      } else if (action === "declineMulti") {
        if (window.confirm("Are you sure you want to decline this reserved allocation?")) {
          await api.post(`/multi-unit-offers/allocations/${allocId}/decline`);
        } else {
          setActiveId(null);
          return;
        }
      } else if (action === "withdraw") {

        if (window.confirm("Are you sure you want to withdraw your offer?")) {
          await api.post(`/offers/${id}/withdraw`);
        } else {
          setActiveId(null);
          return;
        }
      } else if (action === "withdrawMulti") {
        if (window.confirm("Are you sure you want to withdraw your offer?")) {
          await api.post(`/multi-unit-offers/${id}/withdraw`);
        } else {
          setActiveId(null);
          return;
        }
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setActiveId(null);
    }
  };

  const submitRevise = async (e) => {
    e.preventDefault();
    if (!reviseAmount || Number(reviseAmount) <= 0) return;
    setReviseSubmitting(true);
    try {
      if (reviseOfferObj.isMultiUnit) {
        await api.put(`/multi-unit-offers/${reviseOfferObj.id}`, {
          quantityRequested: Number(reviseOfferObj.quantityRequested || 1),
          offeredPricePerUnit: Number(reviseAmount),
          buyerMessage: reviseMessage.trim() || null,
        });
      } else {
        await api.patch(`/offers/${reviseOfferObj.id}`, {
          offeredAmount: Number(reviseAmount),
          buyerMessage: reviseMessage.trim() || null,
        });
      }
      setReviseOfferObj(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setReviseSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {offers.map((offer) => {
          const isPendingConfirm = offer.status === "accepted_pending_buyer" || offer.status === "allocation_reserved";
          const isConfirmed = offer.status === "buyer_confirmed" || offer.status === "confirmed";
          const isCountered = offer.status === "countered";
          const isCancelled = ["cancelled", "rejected", "withdrawn", "declined", "buyer_declined", "seller_declined", "allocation_cancelled"].includes(offer.status);
          const canModify = ["submitted", "revised", "shortlisted", "countered", "contact_requested"].includes(offer.status);

          return (
            <div
              key={offer.id}
              className={`p-4 sm:p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between transition-colors ${
                isCancelled
                  ? "bg-red-50/20 hover:bg-red-50/40 border-l-4 border-l-red-500"
                  : "hover:bg-slate-50/50"
              }`}
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {offer.isMultiUnit && (
                    <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-[#2563eb]">
                      Multi-Unit Offer
                    </span>
                  )}
                  <span className="font-mono text-[11px] font-bold text-slate-400">{offer.listingReference || `OFFER-${offer.id}`}</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      isCancelled
                        ? "bg-red-600 text-white shadow-2xs"
                        : isConfirmed
                          ? "bg-emerald-100 text-emerald-800"
                          : isPendingConfirm
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : isCountered
                              ? "bg-purple-100 text-purple-900"
                              : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {isCancelled && <Ban size={10} />}
                    {offer.status.replace(/_/g, " ")}
                  </span>
                </div>

                <Link
                  href={`/auctions/${offer.publicSlug || offer.listingId}`}
                  className={`font-bold text-sm block ${
                    isCancelled ? "text-slate-700 line-through decoration-red-400 hover:text-slate-900" : "text-[#0f172a] hover:text-[#2563eb]"
                  }`}
                >
                  {offer.listingTitle}
                </Link>

                <div className="text-xs text-slate-500">
                  {offer.isMultiUnit ? (
                    <span>Qty Requested: <strong className="text-slate-800">{offer.quantityRequested}</strong> @ <strong className="text-slate-800">{formatINR(offer.offeredPricePerUnit)}/unit</strong></span>
                  ) : (
                    <span>Asking Price: <span className="font-bold text-slate-800">{formatINR(offer.askingPrice)}</span></span>
                  )}
                </div>

                {isCancelled && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200/80 p-2 text-xs font-semibold text-red-900">
                    <Ban size={13} className="shrink-0 text-red-600" />
                    <span>This offer was {offer.status.replace(/_/g, " ")}. Transaction closed.</span>
                  </div>
                )}

                {offer.counterAmount && !isCancelled && (
                  <div className="mt-2 rounded-lg bg-purple-50 border border-purple-200 p-2.5 text-xs text-purple-900">
                    <span className="font-bold">Seller Counteroffer: {formatINR(offer.counterAmount)}</span>
                    {offer.sellerMessage && <p className="text-[11px] mt-0.5">"{offer.sellerMessage}"</p>}
                  </div>
                )}

                {offer.counterUnitPrice && !isCancelled && (
                  <div className="mt-2 rounded-lg bg-purple-50 border border-purple-200 p-2.5 text-xs text-purple-900">
                    <span className="font-bold">Seller Counter: {offer.counterQuantity || offer.quantityRequested} units @ {formatINR(offer.counterUnitPrice)}/unit</span>
                    {offer.sellerMessage && <p className="text-[11px] mt-0.5">"{offer.sellerMessage}"</p>}
                  </div>
                )}

                {offer.status === "allocation_reserved" && offer.allocation && !isCancelled && (
                  <div className="mt-2 rounded-lg bg-amber-50 border border-amber-300 p-2.5 text-xs text-amber-950 space-y-1">
                    <p className="font-bold text-amber-900">🎉 Reservation Active!</p>
                    <p>Allocated Quantity: <strong>{offer.allocation.allocatedQuantity}</strong> | Unit Price: <strong>{formatINR(offer.allocation.unitPrice)}</strong></p>
                    <p className="text-[11px] text-amber-800">Confirm before deadline ({offer.allocation.reservedUntil ? new Date(offer.allocation.reservedUntil).toLocaleString() : "48h"}) or stock will be released.</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:items-end gap-2 shrink-0">
                <div className="text-right">
                  <div className="text-xs text-slate-500 font-medium">Total Offered Value</div>
                  <div className={`text-lg font-black ${isCancelled ? "text-slate-400 line-through decoration-red-500" : "text-[#0f172a]"}`}>
                    {formatINR(offer.offeredAmount || offer.totalOfferValue)}
                    {isCancelled && <span className="ml-1 text-xs font-bold text-red-600">(Void)</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  {isPendingConfirm && (
                    <>
                      <button
                        type="button"
                        disabled={activeId === offer.id}
                        onClick={() => handleAction(offer.id, offer.isMultiUnit ? "confirmMulti" : "confirm", offer.allocation?.id)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Confirm Allocation
                      </button>
                      <button
                        type="button"
                        disabled={activeId === offer.id}
                        onClick={() => handleAction(offer.id, offer.isMultiUnit ? "declineMulti" : "decline", offer.allocation?.id)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </>
                  )}

                  {canModify && !isCancelled && (
                    <>
                      <button
                        type="button"
                        disabled={activeId === offer.id}
                        onClick={() => {
                          setReviseOfferObj(offer);
                          setReviseAmount(offer.offeredAmount || offer.offeredPricePerUnit);
                          setReviseMessage(offer.buyerMessage || "");
                        }}
                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#2563eb] hover:bg-blue-100 disabled:opacity-50"
                      >
                        Revise
                      </button>
                      <button
                        type="button"
                        disabled={activeId === offer.id}
                        onClick={() => handleAction(offer.id, offer.isMultiUnit ? "withdrawMulti" : "withdraw")}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                      >
                        Withdraw
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Revise Offer Modal */}
      {reviseOfferObj && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4">
          <form onSubmit={submitRevise} className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Revise Your Private Offer</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700">New Offered Amount (₹)</label>
              <input
                type="number"
                required
                min="1"
                value={reviseAmount}
                onChange={(e) => setReviseAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Message to Seller (Optional)</label>
              <textarea
                rows={3}
                value={reviseMessage}
                onChange={(e) => setReviseMessage(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReviseOfferObj(null)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reviseSubmitting}
                className="rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {reviseSubmitting ? "Updating..." : "Submit Revision"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function BuyerDashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("main"); // "main" | "support"
  const [state, setState] = useState({ loading: true, error: "", offers: [], watchlist: [] });
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [rejectionReason, setRejectionReason] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [trackingTicket, setTrackingTicket] = useState(null);

  const load = useCallback(async () => {
    setState((curr) => ({ ...curr, loading: true, error: "" }));
    try {
      const [offersRes, multiOffersRes, watchlistRes] = await Promise.all([
        api.get("/buyer/offers"),
        api.get("/multi-unit-offers/my-offers"),
        api.get("/watchlist"),
      ]);

      const regularOffers = offersRes.data?.items || [];
      const multiOffers = (multiOffersRes.data?.items || []).map((o) => ({
        ...o,
        isMultiUnit: true,
        offeredAmount: o.totalOfferValue,
        askingPrice: o.askingPricePerUnit,
      }));

      setState({
        loading: false,
        error: "",
        offers: [...multiOffers, ...regularOffers],
        watchlist: watchlistRes.data?.items || [],
      });
    } catch (error) {
      setState({ loading: false, error: errorMessage(error), offers: [], watchlist: [] });
    }
  }, []);


  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const { data } = await api.get("/support/my-enquiries", { params: { role: "buyer" } });
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
      setRejectionReason(vs.rejectionReason || null);
    }).catch(() => {
      setVerificationStatus("profile_incomplete");
    });
  }, [load, loadTickets]);

  return (
    <DashboardLayout
      role="buyer"
      title={activeTab === "support" ? "Buyer Support & Complaints" : "My Offers & Activity"}
      description={
        activeTab === "support"
          ? "Manage your lodged complaints, view live ticket tracking, and contact bidmylot admin support."
          : "View your submitted private offers, counteroffers, and saved watchlist."
      }
      activeTab={activeTab}
      onSelectTab={setActiveTab}
    >
      {/* Top Tab Bar */}
      <div className="mb-6 flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("main")}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 ${activeTab !== "support"
              ? "border-[#2563eb] text-[#2563eb]"
              : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
        >
          My Offers & Watchlist
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("support")}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${activeTab === "support"
              ? "border-[#2563eb] text-[#2563eb]"
              : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
        >
          <LifeBuoy size={14} /> Support & Complaints Tracker
          {tickets.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-[#2563eb]">
              {tickets.length}
            </span>
          )}
        </button>
      </div>

      {/* Verification Status Banner */}
      {verificationStatus && verificationStatus !== "verified" && activeTab !== "support" && (
        <VerificationStatusBanner
          status={verificationStatus}
          rejectionReason={rejectionReason}
          role="buyer"
        />
      )}

      {/* TAB 1: MAIN OFFERS & WATCHLIST */}
      {activeTab !== "support" && (
        <>
          {state.loading ? <LoadingState label="Loading your offers..." /> : null}
          {state.error ? <ErrorState message={state.error} onRetry={load} /> : null}
          {!state.loading && !state.error ? (
            <>
              <DashboardSection title="Submitted Offers" description="Private negotiated offers submitted on listings.">
                <BuyerOfferRows offers={state.offers} onRefresh={load} />
                {!state.offers.length ? (
                  <EmptyState title="No offers submitted yet" description="Explore live listings and submit private negotiated offers to sellers." />
                ) : null}
              </DashboardSection>
              <DashboardSection title="Watchlist">
                <AuctionRows items={state.watchlist} />
                {!state.watchlist.length ? (
                  <EmptyState title="Your watchlist is empty" description="Save a public listing and it will appear here." />
                ) : null}
              </DashboardSection>
            </>
          ) : null}
        </>
      )}

      {/* TAB 2: SEPARATE SUPPORT & COMPLAINTS TAB */}
      {activeTab === "support" && (
        <div id="support-section" className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <h2 className="text-xl font-black text-[#0f172a] flex items-center gap-2">
                  <LifeBuoy size={20} className="text-[#2563eb]" /> Support & Complaints Portal
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Lodge complaints regarding listings, sellers, or technical issues, and track your ticket resolution status.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0f172a] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#2563eb] transition-colors shadow-xs"
              >
                <Plus size={15} /> Lodge a Complaint
              </button>
            </div>

            <div className="mt-6">
              {ticketsLoading ? (
                <LoadingState label="Loading support tickets..." />
              ) : tickets.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setTrackingTicket(t)}
                      className="py-4 first:pt-0 last:pb-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between cursor-pointer group hover:bg-slate-50/80 px-3 rounded-xl transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#2563eb]">{t.reference}</span>
                          <StatusBadge status={t.status} />
                        </div>
                        <h4 className="mt-1.5 text-sm font-extrabold text-[#0f172a] group-hover:text-[#2563eb] transition-colors">
                          {t.subject}
                        </h4>
                        <p className="mt-0.5 text-xs text-slate-500 truncate max-w-xl">{t.message}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] text-slate-400">
                          {formatDateTime(t.createdAt)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTrackingTicket(t);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-[#2563eb] hover:bg-blue-50 transition-colors shadow-2xs"
                        >
                          <Eye size={14} /> Track Status
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No support tickets or complaints lodged"
                  description="Have a dispute or query? Click 'Lodge a Complaint' above to open a ticket with admin support."
                />
              )}
            </div>
          </div>
        </div>
      )}

      <SupportComplaintModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => {
          loadTickets();
        }}
        user={user}
        role="buyer"
        userAuctions={state.offers}
      />

      <TicketTrackerModal
        ticket={trackingTicket}
        isOpen={Boolean(trackingTicket)}
        onClose={() => setTrackingTicket(null)}
      />
    </DashboardLayout>
  );
}
