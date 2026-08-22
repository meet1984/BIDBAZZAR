import React, { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageSquare,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import api from "../lib/api";
import { errorMessage, formatINR } from "../lib/format";

export function SellerOffersModal({ listing, isOpen, onClose, onRefresh }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeActionId, setActiveActionId] = useState(null);

  // Counteroffer form state
  const [counterModalOffer, setCounterModalOffer] = useState(null);
  const [counterAmount, setCounterAmount] = useState("");
  const [counterQty, setCounterQty] = useState("");
  const [sellerMessage, setSellerMessage] = useState("");
  const [counterError, setCounterError] = useState("");
  const [counterSubmitting, setCounterSubmitting] = useState(false);

  // Accept offer form state (regular negotiated offer)
  const [acceptModalOffer, setAcceptModalOffer] = useState(null);
  const [deadlineHours, setDeadlineHours] = useState(48);
  const [acceptSubmitting, setAcceptSubmitting] = useState(false);

  // Accept partial form state (multi-unit)
  const [partialModalOffer, setPartialModalOffer] = useState(null);
  const [partialQty, setPartialQty] = useState("");
  const [partialSubmitting, setPartialSubmitting] = useState(false);

  // Bucket collapse states
  const [openBuckets, setOpenBuckets] = useState({
    above: true,
    at: true,
    below: true,
  });

  // Buyer Trust / Reviews Modal state
  const [buyerTrustModal, setBuyerTrustModal] = useState(null);

  const openBuyerTrustModal = async (buyerId, name) => {
    if (!buyerId) return;
    setBuyerTrustModal({ buyerId, name, loading: true, data: null, error: "" });
    try {
      const res = await api.get(`/reviews/trust-profile/${buyerId}`);
      setBuyerTrustModal({ buyerId, name, loading: false, data: res.data?.data, error: "" });
    } catch (err) {
      setBuyerTrustModal({
        buyerId,
        name,
        loading: false,
        data: null,
        error: errorMessage(err, "Failed to load buyer review profile."),
      });
    }
  };

  const isMulti = listing?.saleMode === "multi_unit_offer";

  const fetchOffers = useCallback(async () => {
    if (!listing?.id) return;
    setLoading(true);
    setError("");
    try {
      const endpoint = isMulti
        ? `/multi-unit-offers/seller/listings/${listing.id}/offers`
        : `/seller/listings/${listing.id}/offers`;
      const res = await api.get(endpoint);
      setData(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [listing?.id, isMulti]);

  useEffect(() => {
    if (isOpen && listing?.id) {
      void fetchOffers();
    }
  }, [isOpen, listing?.id, fetchOffers]);

  const [actionError, setActionError] = useState("");

  if (!isOpen || !listing) return null;

  const toggleBucket = (key) => {
    setOpenBuckets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // --- MULTI-UNIT ACTIONS ---
  const handleAcceptFullMulti = async (offerId) => {
    setActiveActionId(offerId);
    setActionError("");
    try {
      await api.post(`/multi-unit-offers/offers/${offerId}/accept-full`);
      await fetchOffers();
      if (onRefresh) onRefresh();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setActiveActionId(null);
    }
  };

  const handleAcceptPartialMulti = async (e) => {
    e.preventDefault();
    if (!partialQty || Number(partialQty) <= 0) return;
    setPartialSubmitting(true);
    setActionError("");
    try {
      await api.post(`/multi-unit-offers/offers/${partialModalOffer.id}/accept-partial`, {
        partialQuantity: Number(partialQty),
      });
      setPartialModalOffer(null);
      await fetchOffers();
      if (onRefresh) onRefresh();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setPartialSubmitting(false);
    }
  };

  const submitMultiCounter = async (e) => {
    e.preventDefault();
    setCounterSubmitting(true);
    setCounterError("");
    setActionError("");
    try {
      await api.post(`/multi-unit-offers/offers/${counterModalOffer.id}/counter`, {
        counterQuantity: counterQty ? Number(counterQty) : undefined,
        counterUnitPrice: counterAmount ? Number(counterAmount) : undefined,
        sellerMessage: sellerMessage.trim() || undefined,
      });
      setCounterModalOffer(null);
      await fetchOffers();
      if (onRefresh) onRefresh();
    } catch (err) {
      setCounterError(errorMessage(err));
    } finally {
      setCounterSubmitting(false);
    }
  };

  const handleShortlistMulti = async (offerId) => {
    setActiveActionId(offerId);
    setActionError("");
    try {
      await api.post(`/multi-unit-offers/offers/${offerId}/shortlist`);
      await fetchOffers();
      if (onRefresh) onRefresh();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setActiveActionId(null);
    }
  };

  const handleRejectMulti = async (offerId) => {
    if (!window.confirm("Are you sure you want to reject this offer?")) return;
    setActiveActionId(offerId);
    setActionError("");
    try {
      await api.post(`/multi-unit-offers/offers/${offerId}/reject`);
      await fetchOffers();
      if (onRefresh) onRefresh();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setActiveActionId(null);
    }
  };

  // --- REGULAR NEGOTIATED OFFER ACTIONS ---
  const handleShortlist = async (offerId) => {
    setActiveActionId(offerId);
    setActionError("");
    try {
      await api.post(`/offers/${offerId}/shortlist`);
      await fetchOffers();
      if (onRefresh) onRefresh();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setActiveActionId(null);
    }
  };

  const handleReject = async (offerId) => {
    if (!window.confirm("Are you sure you want to reject this offer?")) return;
    setActiveActionId(offerId);
    setActionError("");
    try {
      await api.post(`/offers/${offerId}/reject`);
      await fetchOffers();
      if (onRefresh) onRefresh();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setActiveActionId(null);
    }
  };

  const handleRequestContact = async (offerId) => {
    setActiveActionId(offerId);
    setActionError("");
    try {
      await api.post(`/offers/${offerId}/request-contact`);
      await fetchOffers();
      if (onRefresh) onRefresh();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setActiveActionId(null);
    }
  };

  const submitCounteroffer = async (e) => {
    e.preventDefault();
    if (!counterAmount || Number(counterAmount) <= 0) {
      setCounterError("Please enter a valid counteroffer amount.");
      return;
    }
    setCounterSubmitting(true);
    setCounterError("");
    setActionError("");
    try {
      await api.post(`/offers/${counterModalOffer.id}/counter`, {
        counterAmount: Number(counterAmount),
        sellerMessage: sellerMessage.trim() || null,
      });
      setCounterModalOffer(null);
      await fetchOffers();
      if (onRefresh) onRefresh();
    } catch (err) {
      setCounterError(errorMessage(err));
    } finally {
      setCounterSubmitting(false);
    }
  };

  const submitAcceptOffer = async (e) => {
    e.preventDefault();
    setAcceptSubmitting(true);
    setActionError("");
    try {
      await api.post(`/offers/${acceptModalOffer.id}/accept`, {
        confirmDeadlineHours: Number(deadlineHours),
        buyerConfirmationDeadlineHours: Number(deadlineHours),
      });
      setAcceptModalOffer(null);
      await fetchOffers();
      if (onRefresh) onRefresh();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setAcceptSubmitting(false);
    }
  };

  const hasActiveAcceptedOrConfirmed =
    data &&
    !isMulti &&
    [...(data.aboveAsking || []), ...(data.atAsking || []), ...(data.belowAsking || [])].some(
      (o) => o.status === "accepted_pending_buyer" || o.status === "buyer_confirmed",
    );

  const renderOfferCard = (offer) => {
    const isConfirmed = offer.status === "buyer_confirmed";
    const isAccepted = offer.status === "accepted_pending_buyer";
    const isShortlisted = offer.status === "shortlisted";
    const isCountered = offer.status === "countered";
    const isRejected = offer.status === "rejected";

    const buyerName = offer.buyer?.fullName || offer.buyerPublicProfile?.displayName || `Buyer #${offer.buyerId}`;
    const buyerRating = offer.buyer?.averageRating ?? offer.buyerPublicProfile?.averageRating ?? 0;
    const reviewCount = offer.buyer?.completedTransactionsCount ?? offer.buyerPublicProfile?.completedTransactionsCount ?? 0;
    const isVerified = (offer.buyer?.verificationStatus || offer.buyerPublicProfile?.verificationStatus) === "verified";

    return (
      <div
        key={offer.id}
        className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 shadow-xs"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 font-extrabold text-blue-800 text-sm shadow-2xs">
              {buyerName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-slate-900 text-sm">{buyerName}</span>
                {isVerified && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    <ShieldCheck size={11} className="text-emerald-600 shrink-0" /> Verified
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap text-[11px] mt-0.5">
                <span className="text-slate-500 font-medium">
                  {offer.buyer?.businessName || offer.buyer?.legalName || "Buyer Account"}
                </span>
                <span className="text-slate-300">•</span>
                {/* Buyer Rating & Reviews Badge */}
                <button
                  type="button"
                  onClick={() => openBuyerTrustModal(offer.buyerId, buyerName)}
                  className="inline-flex items-center gap-1 rounded-md bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-900 transition cursor-pointer"
                  title="Click to view full buyer reviews and rating breakdown"
                >
                  <Star size={11} className="fill-amber-500 text-amber-500" />
                  <span>{buyerRating > 0 ? `${Number(buyerRating).toFixed(1)}★` : "New Buyer"}</span>
                  <span className="text-amber-700 font-normal">
                    ({reviewCount} review{reviewCount === 1 ? "" : "s"})
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-500 font-medium">Offered Amount</div>
            <div className="text-xl font-black text-slate-900">{formatINR(offer.offeredAmount)}</div>
            <div
              className={`text-[11px] font-bold ${offer.differenceFromAsking > 0
                  ? "text-emerald-700"
                  : offer.differenceFromAsking === 0
                    ? "text-slate-600"
                    : "text-amber-700"
                }`}
            >
              {offer.differenceFromAsking > 0
                ? `+${formatINR(offer.differenceFromAsking)} above asking`
                : offer.differenceFromAsking === 0
                  ? "At asking price"
                  : `${formatINR(offer.differenceFromAsking)} below asking`}
            </div>
          </div>
        </div>

        {/* Buyer message */}
        {offer.buyerMessage && (
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-[12px] text-slate-700 space-y-1">
            {offer.buyerMessage && (
              <p className="flex items-start gap-1.5">
                <MessageSquare size={13} className="shrink-0 text-slate-400 mt-0.5" />
                <span>"{offer.buyerMessage}"</span>
              </p>
            )}
          </div>
        )}

        {/* Counteroffer info */}
        {offer.counterAmount && (
          <div className="mt-3 rounded-lg border border-purple-200 bg-purple-50/60 p-3 text-[12px]">
            <div className="font-bold text-purple-900">Your Counteroffer: {formatINR(offer.counterAmount)}</div>
            {offer.sellerMessage && <p className="text-purple-800 text-[11px] mt-0.5">"{offer.sellerMessage}"</p>}
          </div>
        )}

        {/* Card Footer */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[11px] font-extrabold uppercase ${isConfirmed
                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                  : isAccepted
                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                    : isShortlisted
                      ? "bg-indigo-100 text-indigo-900"
                      : isCountered
                        ? "bg-purple-100 text-purple-900"
                        : isRejected
                          ? "bg-red-100 text-red-900"
                          : "bg-slate-100 text-slate-700"
                }`}
            >
              {isConfirmed ? <CheckCircle2 size={12} /> : null}
              {isAccepted ? <Clock size={12} /> : null}
              {offer.status.replace(/_/g, " ")}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isConfirmed && !isRejected && offer.status !== "withdrawn" && (
              <>
                {!isShortlisted && !isAccepted && (
                  <button
                    type="button"
                    disabled={activeActionId === offer.id}
                    onClick={() => handleShortlist(offer.id)}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                  >
                    Shortlist
                  </button>
                )}

                {!isAccepted && (
                  <button
                    type="button"
                    disabled={activeActionId === offer.id}
                    onClick={() => {
                      setCounterModalOffer(offer);
                      setCounterAmount(offer.counterAmount || offer.offeredAmount);
                      setSellerMessage(offer.sellerMessage || "");
                    }}
                    className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                  >
                    Counter
                  </button>
                )}

                {!isAccepted && (
                  <button
                    type="button"
                    disabled={activeActionId === offer.id}
                    onClick={() => handleRequestContact(offer.id)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Contact Request
                  </button>
                )}

                {!isAccepted && !hasActiveAcceptedOrConfirmed && (
                  <button
                    type="button"
                    disabled={activeActionId === offer.id}
                    onClick={() => setAcceptModalOffer(offer)}
                    className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Accept Offer
                  </button>
                )}

                {!isAccepted && (
                  <button
                    type="button"
                    disabled={activeActionId === offer.id}
                    onClick={() => handleReject(offer.id)}
                    className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    Reject
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Seller Offer Dashboard</span>
            <h2 className="text-lg font-bold text-slate-900">{listing.title}</h2>
            <div className="mt-0.5 text-xs text-slate-600">
              Asking Price: <span className="font-bold text-slate-900">{formatINR(listing.askingPrice || listing.askingPricePerUnit || 0)}</span>
              {data?.totalOffers ? ` • ${data.totalOffers} Total Offers` : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {actionError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 font-semibold flex items-center justify-between">
              <span>{actionError}</span>
              <button type="button" onClick={() => setActionError("")} className="font-bold text-red-500 hover:text-red-800 ml-2">✕</button>
            </div>
          )}
          {loading ? (
            <div className="py-12 text-center text-slate-500">Loading received offers...</div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
          ) : data && isMulti ? (
            /* MULTI-UNIT SELLER DASHBOARD VIEW */
            <div className="space-y-6">
              {/* Inventory Summary Gauge */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Total Stock</span>
                  <span className="font-black text-slate-900 text-lg">{data.totalQuantity} {data.unitName}s</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Remaining Stock</span>
                  <span className="font-black text-blue-700 text-lg">{data.remainingInventory} {data.unitName}s</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Asking Price / Unit</span>
                  <span className="font-black text-slate-900 text-lg">{formatINR(data.askingPricePerUnit)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block flex items-center gap-1">
                    <span>Private Floor Price</span>
                    <span className="text-[10px] text-emerald-700 font-bold">(Seller Only)</span>
                  </span>
                  <span className="font-black text-emerald-800 text-lg">
                    {data.minAcceptableUnitPrice ? formatINR(data.minAcceptableUnitPrice) : "Not Set"}
                  </span>
                </div>
              </div>

              {/* Multi-unit Offers List */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center justify-between">
                  <span>Received Multi-unit Offers ({data.offers?.length || 0})</span>
                </h3>

                {!data.offers || data.offers.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                    No multi-unit offers received yet for this listing.
                  </div>
                ) : (
                  data.offers.map((offer) => {
                    const isReserved = offer.status === "allocation_reserved";
                    const isConfirmed = offer.status === "confirmed";
                    const isCountered = offer.status === "countered";
                    const isRejected = offer.status === "rejected";

                    const buyerName = offer.buyer?.fullName || offer.buyerPublicProfile?.displayName || `Buyer #${offer.buyerId}`;
                    const buyerRating = offer.buyer?.averageRating ?? offer.buyerPublicProfile?.averageRating ?? 0;
                    const reviewCount = offer.buyer?.completedTransactionsCount ?? offer.buyerPublicProfile?.completedTransactionsCount ?? 0;
                    const isVerified = (offer.buyer?.verificationStatus || offer.buyerPublicProfile?.verificationStatus) === "verified";

                    return (
                      <div key={offer.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-800 text-xs shadow-2xs">
                              {buyerName.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-slate-900">{buyerName}</span>
                                {isVerified && (
                                  <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
                                )}
                                {/* Buyer Rating Badge */}
                                <button
                                  type="button"
                                  onClick={() => openBuyerTrustModal(offer.buyerId, buyerName)}
                                  className="inline-flex items-center gap-1 rounded-md bg-amber-50 hover:bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 transition cursor-pointer"
                                  title="Click to view buyer reviews and ratings"
                                >
                                  <Star size={10} className="fill-amber-500 text-amber-500" />
                                  <span>{buyerRating > 0 ? `${Number(buyerRating).toFixed(1)}★` : "New Buyer"}</span>
                                  <span className="text-amber-700 font-normal">
                                    ({reviewCount} review{reviewCount === 1 ? "" : "s"})
                                  </span>
                                </button>
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                Requested: <strong className="text-slate-800">{offer.quantityRequested} {data.unitName}s</strong> @ <strong className="text-slate-800">{formatINR(offer.offeredPricePerUnit)}/unit</strong>
                              </div>
                            </div>
                          </div>

                          <div className="sm:text-right">
                            <div className="text-xs text-slate-500">Total Offer Value</div>
                            <div className="text-lg font-black text-slate-900">{formatINR(offer.totalOfferValue)}</div>
                            <div className={`text-[11px] font-bold ${offer.diffFromAsking >= 0 ? "text-emerald-700" : "text-amber-700"}`}>
                              {offer.diffFromAsking >= 0 ? `+${formatINR(offer.diffFromAsking)} vs asking/unit` : `${formatINR(offer.diffFromAsking)} vs asking/unit`}
                            </div>
                          </div>
                        </div>

                        {offer.buyerMessage && (
                          <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            "{offer.buyerMessage}"
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[11px] font-extrabold uppercase ${isConfirmed
                                ? "bg-emerald-100 text-emerald-800"
                                : isReserved
                                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                                  : isCountered
                                    ? "bg-purple-100 text-purple-900"
                                    : isRejected
                                      ? "bg-red-100 text-red-900"
                                      : "bg-slate-100 text-slate-700"
                              }`}
                          >
                            {offer.status.replace(/_/g, " ")}
                          </span>

                          <div className="flex flex-wrap items-center gap-2">
                            {!isConfirmed && !isReserved && !isRejected && offer.status !== "cancelled" && (
                              <>
                                <button
                                  type="button"
                                  disabled={activeActionId === offer.id || data.remainingInventory < offer.quantityRequested}
                                  onClick={() => handleAcceptFullMulti(offer.id)}
                                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
                                >
                                  Accept Full ({offer.quantityRequested})
                                </button>

                                <button
                                  type="button"
                                  disabled={activeActionId === offer.id || data.remainingInventory <= 0}
                                  onClick={() => {
                                    setPartialModalOffer(offer);
                                    setPartialQty(Math.min(offer.quantityRequested, data.remainingInventory));
                                  }}
                                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
                                >
                                  Accept Partial
                                </button>

                                <button
                                  type="button"
                                  disabled={activeActionId === offer.id}
                                  onClick={() => {
                                    setCounterModalOffer(offer);
                                    setCounterQty(offer.quantityRequested);
                                    setCounterAmount(offer.offeredPricePerUnit);
                                    setSellerMessage("");
                                  }}
                                  className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                                >
                                  Counter
                                </button>

                                <button
                                  type="button"
                                  disabled={activeActionId === offer.id}
                                  onClick={() => handleShortlistMulti(offer.id)}
                                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                                >
                                  Shortlist
                                </button>

                                <button
                                  type="button"
                                  disabled={activeActionId === offer.id}
                                  onClick={() => handleRejectMulti(offer.id)}
                                  className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : data ? (
            /* REGULAR NEGOTIATED OFFERS VIEW */
            <div className="space-y-6">
              {/* Above Asking */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => toggleBucket("above")}
                  className="flex w-full items-center justify-between rounded-xl bg-emerald-50/70 p-3.5 text-xs font-bold text-emerald-900 border border-emerald-200"
                >
                  <span className="flex items-center gap-2">
                    <Star size={16} className="text-emerald-600 fill-emerald-600" />
                    Above Asking Price ({data.aboveAsking?.length || 0})
                  </span>
                  {openBuckets.above ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {openBuckets.above && (
                  <div className="space-y-3 pl-2">
                    {data.aboveAsking?.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">No offers above asking price.</p>
                    ) : (
                      data.aboveAsking.map(renderOfferCard)
                    )}
                  </div>
                )}
              </div>

              {/* At Asking */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => toggleBucket("at")}
                  className="flex w-full items-center justify-between rounded-xl bg-blue-50/70 p-3.5 text-xs font-bold text-blue-900 border border-blue-200"
                >
                  <span>At Asking Price ({data.atAsking?.length || 0})</span>
                  {openBuckets.at ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {openBuckets.at && (
                  <div className="space-y-3 pl-2">
                    {data.atAsking?.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">No offers at asking price.</p>
                    ) : (
                      data.atAsking.map(renderOfferCard)
                    )}
                  </div>
                )}
              </div>

              {/* Below Asking */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => toggleBucket("below")}
                  className="flex w-full items-center justify-between rounded-xl bg-slate-100 p-3.5 text-xs font-bold text-slate-800 border border-slate-200"
                >
                  <span>Below Asking Price ({data.belowAsking?.length || 0})</span>
                  {openBuckets.below ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {openBuckets.below && (
                  <div className="space-y-3 pl-2">
                    {data.belowAsking?.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">No offers below asking price.</p>
                    ) : (
                      data.belowAsking.map(renderOfferCard)
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Counter Modal */}
      {counterModalOffer && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4">
          <form
            onSubmit={isMulti ? submitMultiCounter : submitCounteroffer}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 text-left"
          >
            <h3 className="text-base font-bold text-slate-900">Submit Counteroffer</h3>
            {counterError && <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{counterError}</div>}

            {isMulti ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Counter Quantity ({data?.unitName || "units"})</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={counterQty}
                    onChange={(e) => setCounterQty(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Counter Price Per Unit (₹)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={counterAmount}
                    onChange={(e) => setCounterAmount(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm font-bold text-slate-900"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700">Counter Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={counterAmount}
                  onChange={(e) => setCounterAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm font-bold text-slate-900"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700">Note to Buyer (Optional)</label>
              <textarea
                rows={3}
                value={sellerMessage}
                onChange={(e) => setSellerMessage(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCounterModalOffer(null)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={counterSubmitting}
                className="rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {counterSubmitting ? "Submitting..." : "Send Counteroffer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Partial Accept Modal (Multi-Unit) */}
      {partialModalOffer && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4">
          <form
            onSubmit={handleAcceptPartialMulti}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 text-left"
          >
            <h3 className="text-base font-bold text-slate-900">Accept Partial Quantity</h3>
            <p className="text-xs text-slate-600">
              Buyer requested {partialModalOffer.quantityRequested} {data?.unitName}s. Enter partial quantity to allocate.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Partial Quantity ({data?.unitName}s)</label>
              <input
                type="number"
                required
                min="1"
                max={Math.min(partialModalOffer.quantityRequested, data?.remainingInventory || 9999)}
                value={partialQty}
                onChange={(e) => setPartialQty(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm font-bold text-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPartialModalOffer(null)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={partialSubmitting}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {partialSubmitting ? "Allocating..." : "Reserve Partial Allocation"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Regular Accept Modal */}
      {acceptModalOffer && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4">
          <form
            onSubmit={submitAcceptOffer}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 text-left"
          >
            <h3 className="text-base font-bold text-slate-900">Accept Offer & Lock Listing</h3>
            <p className="text-xs text-slate-600">
              Accepting will reserve this listing for <strong>{acceptModalOffer.buyer?.fullName || "Buyer"}</strong> for the specified deadline.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Confirmation Deadline (Hours)</label>
              <input
                type="number"
                required
                min="1"
                max="168"
                value={deadlineHours}
                onChange={(e) => setDeadlineHours(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm font-bold text-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAcceptModalOffer(null)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={acceptSubmitting}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {acceptSubmitting ? "Accepting..." : "Confirm & Send to Buyer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Buyer Trust & Review Profile Modal */}
      {buyerTrustModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Buyer Trust Profile</span>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  👤 {buyerTrustModal.name || `Buyer #${buyerTrustModal.buyerId}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setBuyerTrustModal(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {buyerTrustModal.loading ? (
              <div className="py-8 text-center text-xs text-slate-500">Loading buyer trust and reviews...</div>
            ) : buyerTrustModal.error ? (
              <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{buyerTrustModal.error}</div>
            ) : buyerTrustModal.data ? (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {/* Summary Score Card */}
                <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-amber-800 uppercase block">Overall Buyer Rating</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-2xl font-black text-amber-900">
                        {buyerTrustModal.data.ratingsSummary?.averageRating || buyerTrustModal.data.ratings?.averageScore ? (buyerTrustModal.data.ratingsSummary?.averageRating ?? buyerTrustModal.data.ratings?.averageScore).toFixed(1) : "New"}
                      </span>
                      <div className="flex text-amber-500">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={16}
                            fill={star <= Math.round(buyerTrustModal.data.ratingsSummary?.averageRating || buyerTrustModal.data.ratings?.averageScore || 0) ? "currentColor" : "none"}
                            className={star <= Math.round(buyerTrustModal.data.ratingsSummary?.averageRating || buyerTrustModal.data.ratings?.averageScore || 0) ? "text-amber-500" : "text-slate-300"}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-700 block">
                      {buyerTrustModal.data.ratingsSummary?.totalReviews ?? buyerTrustModal.data.ratings?.totalReviews ?? 0} Review{(buyerTrustModal.data.ratingsSummary?.totalReviews ?? buyerTrustModal.data.ratings?.totalReviews ?? 0) === 1 ? "" : "s"}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {buyerTrustModal.data.completedTransactionsCount ?? buyerTrustModal.data.metrics?.completedTransactionsCount ?? 0} Completed Deals
                    </span>
                  </div>
                </div>

                {/* Category Ratings Breakdown */}
                {((buyerTrustModal.data.ratingsSummary?.categoryBreakdown && Object.keys(buyerTrustModal.data.ratingsSummary.categoryBreakdown).length > 0) || (buyerTrustModal.data.ratings?.categoryAverages && Object.keys(buyerTrustModal.data.ratings.categoryAverages).length > 0)) && (
                  <div className="space-y-2 rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs">
                    <span className="font-bold text-slate-800 text-[11px] uppercase block">Rating Breakdown</span>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(buyerTrustModal.data.ratingsSummary?.categoryBreakdown || buyerTrustModal.data.ratings?.categoryAverages || {}).map(([cat, score]) => (
                        <div key={cat} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                          <span className="capitalize text-slate-600 text-[11px]">{cat.replace(/([A-Z])/g, " $1")}</span>
                          <span className="font-bold text-amber-800">{Number(score).toFixed(1)}★</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Reviews List */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-xs">Recent Feedback from Sellers</h4>
                  {!(buyerTrustModal.data.reviews || buyerTrustModal.data.recentReviews)?.length ? (
                    <p className="text-xs text-slate-500 italic py-2">No written reviews yet for this buyer.</p>
                  ) : (
                    (buyerTrustModal.data.reviews || buyerTrustModal.data.recentReviews).map((rev) => (
                      <div key={rev.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-amber-600 flex items-center gap-1">
                            <Star size={12} fill="currentColor" /> {rev.ratingScore}/5
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(rev.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {rev.comment && <p className="text-slate-700 italic">"{rev.comment}"</p>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBuyerTrustModal(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
