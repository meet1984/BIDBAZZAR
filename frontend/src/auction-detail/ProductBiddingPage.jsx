import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Boxes,
  Clock,
  Heart,
  Lock,
  MapPin,
  Send,
  ShieldCheck,
  Star,
  Tag,
  Timer,
} from "lucide-react";
import api from "../lib/api";
import { useAuctionTiming } from "../hooks/useCountdown";
import { Footer, Navbar } from "../components";
import { useAuth } from "../auth/AuthContext";
import { errorMessage, formatCurrency, formatDateTime, formatINR } from "../lib/format";
import { resolveImageUrl } from "../lib/image";

function LockedBiddingCard({ listing, timing }) {
  const { user } = useAuth();
  const [watched, setWatched] = useState(Boolean(listing?.isWatched));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleToggleWatch = async () => {
    if (!user) {
      window.location.assign(`/login?returnTo=${encodeURIComponent(`/auctions/${listing.publicSlug || listing.id}`)}`);
      return;
    }
    if (user.role !== "buyer" && user.accountType !== "buyer") {
      alert("Only verified buyer accounts can save listings to a watchlist.");
      return;
    }
    setSaving(true);
    try {
      const res = watched
        ? await api.delete(`/watchlist/${listing.id}`)
        : await api.post(`/watchlist/${listing.id}`);
      setWatched(Boolean(res.data?.watched));
      setMessage(watched ? "Removed from watchlist" : "Listing saved! You'll be notified as soon as bidding begins.");
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-5 text-center space-y-4">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-100 text-blue-700 shadow-2xs">
        <Lock size={22} />
      </div>

      <div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-100/90 border border-blue-200 px-3 py-0.5 text-[11px] font-bold text-blue-800 mb-2">
          <Timer size={12} className="animate-spin-slow" /> Scheduled Auction • Opening Soon
        </div>
        <h4 className="text-base font-extrabold text-slate-900">
          Bidding & Offers Are Currently Locked
        </h4>
        <p className="mt-1 text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
          This auction has not opened yet. Buyer offer submissions will unlock automatically once the start countdown finishes.
        </p>
      </div>

      {/* Start Timing Box */}
      <div className="rounded-xl border border-blue-200/80 bg-white p-3.5 text-xs space-y-2 text-left">
        <div className="flex justify-between items-center text-slate-600">
          <span className="font-semibold">Bidding Opens:</span>
          <span className="font-bold text-slate-900">{formatDateTime(listing.startTime)}</span>
        </div>
        <div className="flex justify-between items-center border-t border-slate-100 pt-2">
          <span className="font-semibold text-blue-700">Time Until Start:</span>
          <span className="font-mono text-sm font-black text-blue-700">{timing.formattedTime}</span>
        </div>
      </div>

      {message && (
        <p className={`text-xs font-semibold ${watched ? "text-emerald-700" : "text-slate-600"}`}>{message}</p>
      )}

      {/* Action to Bookmark / Remind Me */}
      <button
        type="button"
        disabled={saving}
        onClick={handleToggleWatch}
        className={`w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition shadow-xs ${watched
          ? "bg-slate-900 text-white hover:bg-slate-800"
          : "bg-[#2563eb] text-white hover:bg-blue-700"
          }`}
      >
        <Heart size={15} fill={watched ? "currentColor" : "none"} />
        {watched ? "Saved in Watchlist (Reminder Active)" : "Remind Me When Bidding Opens"}
      </button>
    </div>
  );
}

function BuyerOfferCard({ listing, timing }) {
  const { user } = useAuth();
  const [existingOffer, setExistingOffer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Form states
  const [offeredAmount, setOfferedAmount] = useState("");
  const [buyerMessage, setBuyerMessage] = useState("");
  const [showReviseModal, setShowReviseModal] = useState(false);

  const listingId = listing?.id;

  const fetchUserOffer = useCallback(async () => {
    if (!user || user.accountType !== "buyer" || !listingId) return;
    setLoading(true);
    try {
      const { data } = await api.get("/buyer/offers");
      const activeStatuses = [
        "submitted",
        "revised",
        "shortlisted",
        "countered",
        "contact_requested",
        "accepted_pending_buyer",
        "buyer_confirmed",
      ];
      const match = (data.items || []).find(
        (o) => Number(o.listingId) === Number(listingId) && activeStatuses.includes(o.status),
      );
      setExistingOffer(match || null);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [user, listingId]);

  useEffect(() => {
    void fetchUserOffer();
  }, [user, listingId, fetchUserOffer]);

  if (!listing) return null;

  const handleSubmitOffer = async (e) => {
    e.preventDefault();
    if (!offeredAmount || Number(offeredAmount) <= 0) {
      setError("Please enter a valid offer amount.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccessMessage("");
    try {
      await api.post(`/listings/${listing.id}/offers`, {
        offeredAmount: Number(offeredAmount),
        buyerMessage: buyerMessage.trim() || null,
      });
      setSuccessMessage("Your private offer has been submitted to the seller.");
      await fetchUserOffer();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPurchase = async () => {
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/offers/${existingOffer.id}/buyer-confirm`);
      setSuccessMessage("Purchase confirmed! The listing is now marked as sold to you.");
      await fetchUserOffer();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeclineOffer = async () => {
    if (!window.confirm("Are you sure you want to decline this accepted offer?")) return;
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/offers/${existingOffer.id}/buyer-decline`);
      await fetchUserOffer();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdrawOffer = async () => {
    if (!window.confirm("Are you sure you want to withdraw your offer?")) return;
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/offers/${existingOffer.id}/withdraw`);
      await fetchUserOffer();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs text-center">
        <Lock size={24} className="mx-auto text-slate-400 mb-2" />
        <h4 className="font-bold text-slate-900 text-sm">Submit a Private Negotiated Offer</h4>
        <p className="mt-1 text-xs text-slate-500">Sign in as a verified buyer to negotiate price directly with the seller.</p>
        <a
          href={`/login?returnTo=${encodeURIComponent(`/auctions/${listing.publicSlug || listing.id}`)}`}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-5 py-2 text-xs font-bold text-white hover:bg-blue-700"
        >
          Sign In to Submit Offer
        </a>
      </div>
    );
  }

  if (user.accountType === "seller" && Number(user.id) === Number(listing.sellerId)) {
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-5 text-indigo-900 text-xs leading-relaxed">
        <span className="font-bold block text-sm text-indigo-950 mb-1">Seller Dashboard Notice</span>
        You are the owner of this listing. View and manage all received private offers in your Seller Dashboard.
        <a
          href="/seller/dashboard"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
        >
          Open Seller Offers Dashboard
        </a>
      </div>
    );
  }

  if (timing?.isUpcoming || listing.status === "upcoming" || (listing.startTime && new Date(listing.startTime).getTime() > Date.now())) {
    return <LockedBiddingCard listing={listing} timing={timing} />;
  }

  if (loading) {
    return <div className="py-6 text-center text-xs text-slate-500">Checking your offer status...</div>;
  }

  // Active Offer Already Submitted
  if (existingOffer) {
    const isPendingConfirm = existingOffer.status === "accepted_pending_buyer";
    const isConfirmed = existingOffer.status === "buyer_confirmed";
    const isCountered = existingOffer.status === "countered";
    const canModify = ["submitted", "revised", "shortlisted", "countered", "contact_requested"].includes(existingOffer.status);

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-xs font-bold text-slate-500">Your Private Offer</span>
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[11px] font-extrabold uppercase ${isConfirmed
              ? "bg-emerald-100 text-emerald-800"
              : isPendingConfirm
                ? "bg-amber-100 text-amber-900 border border-amber-300"
                : isCountered
                  ? "bg-purple-100 text-purple-900"
                  : "bg-slate-100 text-slate-700"
              }`}
          >
            {existingOffer.status.replace(/_/g, " ")}
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-500">Offered Amount</span>
          <span className="text-2xl font-black text-[#0f172a]">{formatINR(existingOffer.offeredAmount)}</span>
        </div>

        {existingOffer.counterAmount && (
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs text-purple-900">
            <span className="font-bold">Seller Counteroffer: {formatINR(existingOffer.counterAmount)}</span>
            {existingOffer.sellerMessage && <p className="mt-0.5 text-[11px]">"{existingOffer.sellerMessage}"</p>}
          </div>
        )}

        {isConfirmed && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/90 p-4 text-xs text-emerald-950 space-y-2">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-white font-bold text-xs">
                ✓
              </span>
              <span className="font-extrabold text-sm text-emerald-950">
                🎉 Deal Confirmed: Lot Awarded to You!
              </span>
            </div>
            <p className="text-emerald-900/90 leading-relaxed">
              Both parties have accepted and confirmed this deal. The seller has awarded this lot to you.
              You can now proceed to the Order Centre to view seller contact details and coordinate direct settlement.
            </p>
            <a
              href="/orders"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800"
            >
              Open in Order Centre →
            </a>
          </div>
        )}

        {isPendingConfirm && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 space-y-2">
            <p className="font-bold">🎉 The seller has accepted your offer!</p>
            <p className="text-[11px]">Please confirm your purchase to finalize the transaction.</p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmPurchase}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Confirm Purchase
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDeclineOffer}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {canModify && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setOfferedAmount(existingOffer.offeredAmount);
                setBuyerMessage(existingOffer.buyerMessage || "");
                setShowReviseModal(true);
              }}
              className="flex-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-[#2563eb] hover:bg-blue-100"
            >
              Revise Offer
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleWithdrawOffer}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Withdraw
            </button>
          </div>
        )}

        {/* Revise Modal */}
        {showReviseModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSubmitting(true);
                try {
                  await api.patch(`/offers/${existingOffer.id}`, {
                    offeredAmount: Number(offeredAmount),
                    buyerMessage: buyerMessage.trim() || null,
                  });
                  setShowReviseModal(false);
                  await fetchUserOffer();
                } catch (err) {
                  setError(errorMessage(err));
                } finally {
                  setSubmitting(false);
                }
              }}
              className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 text-left"
            >
              <h3 className="text-base font-bold text-slate-900">Revise Private Offer</h3>
              <div>
                <label className="block text-xs font-semibold text-slate-700">New Offer Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={offeredAmount}
                  onChange={(e) => setOfferedAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Message to Seller (Optional)</label>
                <textarea
                  rows={3}
                  value={buyerMessage}
                  onChange={(e) => setBuyerMessage(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReviseModal(false)}
                  className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "Updating..." : "Update Offer"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // Form to Submit New Offer
  return (
    <form onSubmit={handleSubmitOffer} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
          <Send size={15} className="text-[#2563eb]" /> Submit Private Negotiated Offer
        </h4>
        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          Private to Seller
        </span>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">{error}</div>}
      {successMessage && <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">{successMessage}</div>}

      <div>
        <label className="block text-xs font-bold text-slate-700">
          Your Offered Amount (₹)
        </label>
        <span className="text-[11px] text-slate-500 block mb-1">
          You may offer above, at, or below asking price ({formatINR(listing.askingPrice || listing.askingPricePerUnit || 0)}).
        </span>
        <input
          type="number"
          required
          min="1"
          placeholder="Enter offer amount in INR"
          value={offeredAmount}
          onChange={(e) => setOfferedAmount(e.target.value)}
          className="w-full rounded-lg border border-slate-300 p-2.5 text-sm font-bold text-slate-900 focus:border-[#2563eb] focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700">Private Note to Seller (Optional)</label>
        <textarea
          rows={2}
          placeholder="Add a private negotiation note..."
          value={buyerMessage}
          onChange={(e) => setBuyerMessage(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-[#2563eb] py-3 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-xs"
      >
        {submitting ? "Submitting Private Offer..." : "Submit Private Offer to Seller"}
      </button>
    </form>
  );
}

function MultiUnitOfferCard({ listing, timing }) {
  const { user } = useAuth();
  const [existingOffer, setExistingOffer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const totalQuantity = listing?.totalQuantity || listing?.total_quantity || 1;
  const unitName = listing?.unitName || listing?.unit_name || "unit";
  const askingPricePerUnit = listing?.askingPricePerUnit || listing?.asking_price_per_unit || 0;
  const minOrderQuantity = listing?.minOrderQuantity || listing?.min_order_quantity || 1;
  const maxOrderQuantity = listing?.maxOrderQuantity || listing?.max_order_quantity || totalQuantity;
  const quantityIncrement = listing?.quantityIncrement || listing?.quantity_increment || 1;
  const remainingInventory = listing?.remainingInventory ?? totalQuantity;

  // Form state
  const [quantityRequested, setQuantityRequested] = useState(minOrderQuantity);
  const [offeredPricePerUnit, setOfferedPricePerUnit] = useState(askingPricePerUnit);
  const [buyerMessage, setBuyerMessage] = useState("");

  // Modals
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [reviseQuantity, setReviseQuantity] = useState(minOrderQuantity);
  const [revisePrice, setRevisePrice] = useState(askingPricePerUnit);

  const listingId = listing?.id;

  const fetchUserOffer = useCallback(async () => {
    if (!user || user.accountType !== "buyer" || !listingId) return;
    setLoading(true);
    try {
      const { data } = await api.get("/multi-unit-offers/my-offers");
      const activeStatuses = [
        "submitted",
        "revised",
        "shortlisted",
        "countered",
        "allocation_proposed",
        "allocation_reserved",
        "confirmed",
      ];
      const match = (data.items || []).find(
        (o) => Number(o.listingId) === Number(listingId) && activeStatuses.includes(o.status),
      );
      setExistingOffer(match || null);
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, [user, listingId]);

  useEffect(() => {
    void fetchUserOffer();
  }, [user, listingId, fetchUserOffer]);

  if (!listing) return null;

  const totalOfferValue = Number((Number(quantityRequested || 0) * Number(offeredPricePerUnit || 0)).toFixed(2));

  const handleOpenConfirm = (e) => {
    e.preventDefault();
    setError("");
    const qty = Number(quantityRequested);
    const price = Number(offeredPricePerUnit);

    if (!qty || qty < minOrderQuantity) {
      setError(`Quantity requested must be at least ${minOrderQuantity} ${unitName}(s).`);
      return;
    }
    if (qty > maxOrderQuantity) {
      setError(`Quantity requested cannot exceed maximum of ${maxOrderQuantity} ${unitName}(s).`);
      return;
    }
    if (qty > totalQuantity) {
      setError(`Quantity requested cannot exceed total available stock (${totalQuantity}).`);
      return;
    }
    if (price <= 0) {
      setError("Offered price per unit must be greater than zero.");
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    setSubmitting(true);
    setError("");
    setSuccessMessage("");
    try {
      await api.post(`/multi-unit-offers/listings/${listing.id}/offers`, {
        quantityRequested: Number(quantityRequested),
        offeredPricePerUnit: Number(offeredPricePerUnit),
        buyerMessage: buyerMessage.trim() || null,
      });
      setSuccessMessage("Your multi-unit offer has been submitted to the seller.");
      setShowConfirmModal(false);
      await fetchUserOffer();
    } catch (err) {
      setError(errorMessage(err));
      setShowConfirmModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmAllocation = async (allocationId) => {
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/multi-unit-offers/allocations/${allocationId}/confirm`);
      setSuccessMessage("Reserved allocation confirmed successfully!");
      await fetchUserOffer();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeclineAllocation = async (allocationId) => {
    if (!window.confirm("Are you sure you want to decline this reserved allocation?")) return;
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/multi-unit-offers/allocations/${allocationId}/decline`);
      await fetchUserOffer();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdrawOffer = async () => {
    if (!window.confirm("Are you sure you want to withdraw your offer?")) return;
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/multi-unit-offers/${existingOffer.id}/withdraw`);
      await fetchUserOffer();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs text-center space-y-3">
        <Lock size={24} className="mx-auto text-slate-400" />
        <h4 className="font-bold text-slate-900 text-sm">Multi-unit Offer Submission</h4>
        <p className="text-xs text-slate-500">Sign in as a verified buyer to submit quantity and per-unit price offers.</p>
        <a
          href={`/login?returnTo=${encodeURIComponent(`/auctions/${listing.publicSlug || listing.id}`)}`}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-5 py-2 text-xs font-bold text-white hover:bg-blue-700"
        >
          Sign In to Submit Offer
        </a>
      </div>
    );
  }

  if (user.accountType === "seller" && Number(user.id) === Number(listing.sellerId)) {
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-5 text-indigo-900 text-xs leading-relaxed">
        <span className="font-bold block text-sm text-indigo-950 mb-1">Seller Dashboard Notice</span>
        You own this multi-unit listing. View received offers and allocate stock in your Seller Dashboard.
        <a
          href="/seller/dashboard"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
        >
          Manage Seller Offers
        </a>
      </div>
    );
  }

  if (timing?.isUpcoming || listing.status === "upcoming" || (listing.startTime && new Date(listing.startTime).getTime() > Date.now())) {
    return <LockedBiddingCard listing={listing} timing={timing} />;
  }

  if (loading) {
    return <div className="py-6 text-center text-xs text-slate-500">Checking multi-unit offer status...</div>;
  }

  // Active Multi-unit offer state
  if (existingOffer) {
    const isReserved = existingOffer.status === "allocation_reserved";
    const isConfirmed = existingOffer.status === "confirmed";
    const isCountered = existingOffer.status === "countered";
    const canModify = ["submitted", "revised", "shortlisted", "countered"].includes(existingOffer.status);

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-xs font-bold text-slate-500">Your Active Multi-unit Offer</span>
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[11px] font-extrabold uppercase ${isConfirmed
              ? "bg-emerald-100 text-emerald-800"
              : isReserved
                ? "bg-amber-100 text-amber-900 border border-amber-300"
                : isCountered
                  ? "bg-purple-100 text-purple-900"
                  : "bg-slate-100 text-slate-700"
              }`}
          >
            {existingOffer.status.replace(/_/g, " ")}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div>
            <span className="text-slate-500 block">Requested Quantity</span>
            <span className="font-bold text-slate-900 text-sm">{existingOffer.quantityRequested} {unitName}(s)</span>
          </div>
          <div>
            <span className="text-slate-500 block">Offered Unit Price</span>
            <span className="font-bold text-slate-900 text-sm">{formatINR(existingOffer.offeredPricePerUnit)}</span>
          </div>
          <div className="col-span-2 pt-2 border-t border-slate-200/60 flex justify-between items-baseline">
            <span className="text-slate-600 font-semibold">Total Offer Value</span>
            <span className="text-xl font-black text-[#0f172a]">{formatINR(existingOffer.totalOfferValue)}</span>
          </div>
        </div>

        {isCountered && (
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs text-purple-900 space-y-1">
            <p className="font-bold">Seller Counteroffer:</p>
            <p>Qty: <strong>{existingOffer.counterQuantity || existingOffer.quantityRequested} {unitName}(s)</strong> at <strong>{formatINR(existingOffer.counterUnitPrice || existingOffer.offeredPricePerUnit)}/unit</strong></p>
            {existingOffer.sellerMessage && <p className="text-[11px] italic mt-0.5">"{existingOffer.sellerMessage}"</p>}
          </div>
        )}

        {isReserved && existingOffer.allocation && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 space-y-2">
            <p className="font-bold text-sm text-amber-900">🎉 Seller Reserved Stock For You!</p>
            <p>Allocated Quantity: <strong>{existingOffer.allocation.allocatedQuantity} {unitName}(s)</strong></p>
            <p>Unit Price: <strong>{formatINR(existingOffer.allocation.unitPrice)}</strong></p>
            <p className="text-[11px] text-amber-800">
              Confirm before deadline ({existingOffer.allocation.reservedUntil ? new Date(existingOffer.allocation.reservedUntil).toLocaleString() : "48h"}) or stock will be released.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleConfirmAllocation(existingOffer.allocation.id)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Confirm Allocation
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleDeclineAllocation(existingOffer.allocation.id)}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {canModify && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setReviseQuantity(existingOffer.quantityRequested);
                setRevisePrice(existingOffer.offeredPricePerUnit);
                setBuyerMessage(existingOffer.buyerMessage || "");
                setShowReviseModal(true);
              }}
              className="flex-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-[#2563eb] hover:bg-blue-100"
            >
              Revise Offer
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleWithdrawOffer}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Withdraw
            </button>
          </div>
        )}

        {/* Revise Modal */}
        {showReviseModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSubmitting(true);
                try {
                  await api.put(`/multi-unit-offers/${existingOffer.id}`, {
                    quantityRequested: Number(reviseQuantity),
                    offeredPricePerUnit: Number(revisePrice),
                    buyerMessage: buyerMessage.trim() || null,
                  });
                  setShowReviseModal(false);
                  await fetchUserOffer();
                } catch (err) {
                  setError(errorMessage(err));
                } finally {
                  setSubmitting(false);
                }
              }}
              className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 text-left"
            >
              <h3 className="text-base font-bold text-slate-900">Revise Multi-unit Offer</h3>
              <div>
                <label className="block text-xs font-semibold text-slate-700">New Quantity ({unitName}s)</label>
                <input
                  type="number"
                  required
                  min={minOrderQuantity}
                  max={maxOrderQuantity}
                  step={quantityIncrement}
                  value={reviseQuantity}
                  onChange={(e) => setReviseQuantity(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">New Offered Price Per Unit (₹)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={revisePrice}
                  onChange={(e) => setRevisePrice(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Message to Seller (Optional)</label>
                <textarea
                  rows={2}
                  value={buyerMessage}
                  onChange={(e) => setBuyerMessage(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReviseModal(false)}
                  className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "Updating..." : "Submit Revision"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // Calculator Form to Submit New Multi-Unit Offer
  return (
    <form onSubmit={handleOpenConfirm} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
          <Boxes size={16} className="text-[#2563eb]" /> Submit Multi-unit Offer
        </h4>
        <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
          Multi-unit Lot
        </span>
      </div>

      {/* Inventory Gauge */}
      <div className="rounded-lg bg-slate-50 p-3 border border-slate-100 space-y-1.5">
        <div className="flex justify-between text-xs text-slate-600">
          <span>Available Stock:</span>
          <span className="font-bold text-slate-900">{remainingInventory} / {totalQuantity} {unitName}s</span>
        </div>
        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div
            className="bg-[#2563eb] h-full transition-all duration-300"
            style={{ width: `${Math.min(100, (remainingInventory / totalQuantity) * 100)}%` }}
          />
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">{error}</div>}
      {successMessage && <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">{successMessage}</div>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700">
            Quantity ({unitName}s) *
          </label>
          <span className="text-[10px] text-slate-500 block mb-1">Min: {minOrderQuantity} | Step: {quantityIncrement}</span>
          <input
            type="number"
            required
            min={minOrderQuantity}
            max={maxOrderQuantity}
            step={quantityIncrement}
            value={quantityRequested}
            onChange={(e) => setQuantityRequested(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm font-bold text-slate-900 focus:border-[#2563eb] focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700">
            Offered Unit Price (₹) *
          </label>
          <span className="text-[10px] text-slate-500 block mb-1">Asking: {formatINR(askingPricePerUnit)}</span>
          <input
            type="number"
            required
            min="0"
            step="0.01"
            value={offeredPricePerUnit}
            onChange={(e) => setOfferedPricePerUnit(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm font-bold text-slate-900 focus:border-[#2563eb] focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Dynamic Offer Calculator Output */}
      <div className="rounded-lg bg-blue-50/70 border border-blue-200 p-3 flex justify-between items-center text-xs">
        <span className="text-blue-900 font-semibold">Calculated Total Offer Value:</span>
        <span className="text-lg font-black text-[#2563eb]">{formatINR(totalOfferValue)}</span>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700">Message to Seller (Optional)</label>
        <textarea
          rows={2}
          placeholder="Add private negotiation details..."
          value={buyerMessage}
          onChange={(e) => setBuyerMessage(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-[#2563eb] py-3 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-xs"
      >
        Calculate & Submit Multi-unit Offer
      </button>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 text-left">
            <h3 className="text-base font-bold text-slate-900">Confirm Multi-unit Offer Submission</h3>
            <p className="text-xs text-slate-600">Please review your itemized offer details before submitting to the seller.</p>

            <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Requested Quantity:</span>
                <span className="font-bold text-slate-900">{quantityRequested} {unitName}(s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Offered Price Per Unit:</span>
                <span className="font-bold text-slate-900">{formatINR(offeredPricePerUnit)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-sm">
                <span className="font-bold text-slate-700">Total Offer Value:</span>
                <span className="font-black text-[#2563eb]">{formatINR(totalOfferValue)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmSubmit}
                className="rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Confirm & Send Offer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}


function saveRecentlyViewed(item) {
  if (!item || !item.id) return;
  try {
    const raw = localStorage.getItem("bidmylot_recently_viewed");
    let list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    list = list.filter((x) => x.id !== item.id);
    const entry = {
      id: item.id,
      slug: item.publicSlug || item.slug || String(item.id),
      title: item.title,
      imageUrl: resolveImageUrl(item.primaryImageUrl || item.imageUrl || item.thumbnailUrl || (Array.isArray(item.images) && item.images[0]?.imageUrl) || ""),
      askingPrice: item.askingPrice ?? item.startingPrice ?? item.currentBid ?? 0,
      status: item.status || "live",
      condition: item.condition || "new",
      categoryName: item.category?.name || item.categoryName || "General",
      listingReference: item.listingReference || `LOT-${item.id}`,
    };
    list.unshift(entry);
    list = list.slice(0, 8);
    localStorage.setItem("bidmylot_recently_viewed", JSON.stringify(list));
  } catch {
    // Ignore storage write issues
  }
}

export default function ProductBiddingPage() {
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState("");

  const pathname = window.location.pathname;
  const identifier = pathname.split("/").filter(Boolean).pop();

  useEffect(() => {
    if (!identifier) return;
    setLoading(true);
    api
      .get(`/listings/${identifier}`)
      .then((res) => {
        const item = res.data?.listing;
        setListing(item);
        const firstImg = item?.images?.[0]?.imageUrl || item?.imageUrl || item?.thumbnailUrl || "";
        setSelectedImage(firstImg);
        if (item) saveRecentlyViewed(item);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || "Listing not found.");
      })
      .finally(() => setLoading(false));
  }, [identifier]);

  const timing = useAuctionTiming(listing?.startTime, listing?.endTime, listing?.status);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="mx-auto max-w-7xl px-4 py-16 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#2563eb] border-t-transparent" />
          <p className="mt-4 text-slate-600 font-medium">Loading listing details...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <div className="rounded-xl border border-red-200 bg-white p-12 shadow-xs">
            <h2 className="text-xl font-bold text-slate-900">Listing Not Found</h2>
            <p className="mt-2 text-slate-600">{error || "The requested listing does not exist or has been removed."}</p>
            <a
              href="/auctions"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <ArrowLeft size={16} /> Return to Browse Listings
            </a>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const gallery = listing.images && listing.images.length > 0
    ? listing.images.map((img) => ({ url: resolveImageUrl(img.imageUrl || img.url) }))
    : listing.galleryImages && listing.galleryImages.length > 0
      ? listing.galleryImages.map((img) => ({ url: resolveImageUrl(img.url || img.imageUrl || img) }))
      : [{ url: resolveImageUrl(listing.imageUrl || selectedImage) }];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-[13px] font-medium text-slate-500 mb-6">
          <a href="/auctions" className="hover:text-[#2563eb]">Listings</a>
          <span>/</span>
          <span>{listing.category?.name || "Category"}</span>
          {listing.subcategory?.name && (
            <>
              <span>/</span>
              <span>{listing.subcategory.name}</span>
            </>
          )}
          <span>/</span>
          <span className="text-slate-900 font-semibold truncate max-w-xs">{listing.title}</span>
        </nav>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Column: Image Gallery */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <img
                src={resolveImageUrl(selectedImage) || gallery[0]?.url}
                alt={listing.title}
                className="absolute inset-0 h-full w-full object-cover"
              />

              <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                {timing.isUpcoming ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/90 bg-blue-50/95 px-3 py-1 text-xs font-bold text-blue-700 shadow-sm backdrop-blur-xs">
                    <Timer size={13} className="animate-spin-slow text-blue-600" /> Opening Soon
                  </span>
                ) : timing.isEndingSoon ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/90 bg-amber-50/95 px-3 py-1 text-xs font-bold text-amber-800 shadow-sm backdrop-blur-xs">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" /> Ending Soon
                  </span>
                ) : timing.isLive ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/90 bg-emerald-50/95 px-3 py-1 text-xs font-bold text-emerald-800 shadow-sm backdrop-blur-xs">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live Now
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-300/80 bg-slate-100/90 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur-xs">
                    Closed
                  </span>
                )}

                {listing.saleMode === "multi_unit_offer" ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200/80 bg-indigo-50/90 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm backdrop-blur-xs">
                    <Boxes size={14} /> Multi-Unit Lot
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-xs">
                    <Tag size={14} /> Negotiated Offer
                  </span>
                )}
              </div>
            </div>

            {/* Gallery Thumbnails */}
            {gallery.length > 1 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-2">
                {gallery.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImage(img.url)}
                    className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition ${selectedImage === img.url ? "border-[#2563eb] ring-2 ring-[#2563eb]/20" : "border-slate-200 opacity-70 hover:opacity-100"
                      }`}
                  >
                    <img src={img.url} alt={`Thumbnail ${idx + 1}`} className="absolute inset-0 h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Description */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <h3 className="text-lg font-bold text-[#0f172a]">Item Description & Specifications</h3>
              <div className="mt-4 whitespace-pre-line text-[14px] leading-relaxed text-slate-700">
                {listing.description}
              </div>
            </div>

            {/* Seller Profile & Trust Box */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-[#2563eb] font-bold text-lg border border-blue-100 shadow-2xs">
                    {(listing.sellerName || "S")[0].toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-base flex items-center gap-1.5">
                      {listing.sellerName || "Verified Enterprise Seller"}
                      <ShieldCheck size={16} className="text-emerald-600" />
                    </h4>
                    <span className="text-xs text-slate-500 font-medium">Compliance-verified Enterprise Seller Account</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-1.5 text-amber-800 bg-amber-50 border border-amber-200/90 px-3 py-1 rounded-xl text-sm font-black shadow-2xs">
                    <Star size={15} className="fill-amber-400 text-amber-400" />
                    <span>{listing.sellerRating && Number(listing.sellerRating) > 0 ? Number(listing.sellerRating).toFixed(1) : "5.0"}</span>
                    <span className="text-xs text-slate-500 font-normal">/ 5.0</span>
                  </div>
                  <span className="text-[11px] text-slate-500 block mt-0.5 font-medium">
                    {listing.sellerReviewCount || 0} verified buyer reviews
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs pt-1">
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">ID & Business KYC</span>
                  <span className="font-bold text-emerald-700 flex items-center gap-1 mt-1 text-xs">
                    <ShieldCheck size={14} /> Verified Seller
                  </span>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Seller Rating</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1 mt-1 text-xs">
                    <Star size={14} className="fill-amber-400 text-amber-400" />
                    {listing.sellerRating && Number(listing.sellerRating) > 0 ? `${Number(listing.sellerRating).toFixed(1)} / 5.0 Rating` : "5.0 (Top Rated)"}
                  </span>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Buyer Protection</span>
                  <span className="font-bold text-[#2563eb] flex items-center gap-1 mt-1 text-xs">
                    <Lock size={14} /> BidMyLot Escrow
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Listing Details & Pricing Sidebar */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
              <div>
                <div className="flex items-center justify-between text-[12px] font-semibold text-slate-500">
                  <span>LOT REF: {listing.listingReference || `LOT-${listing.id}`}</span>
                  <span className="capitalize">{listing.condition?.replace("-", " ") || "New"}</span>
                </div>

                <h1 className="mt-2 text-2xl font-bold text-[#0f172a] leading-tight">
                  {listing.title}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={15} className="text-slate-400" /> {listing.location || "India"}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
                    <ShieldCheck size={16} /> {listing.sellerName || "Verified Seller"}
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-50 border border-amber-200/90 px-2 py-0.5 rounded-md text-xs">
                    <Star size={12} className="fill-amber-400 text-amber-400" />
                    <span>{listing.sellerRating && Number(listing.sellerRating) > 0 ? Number(listing.sellerRating).toFixed(1) : "5.0"}</span>
                    <span className="text-slate-500 font-normal text-[11px]">({listing.sellerReviewCount || 0})</span>
                  </span>
                </div>
              </div>

              {/* Dynamic Timing / Countdown Bar */}
              {timing.isUpcoming ? (
                <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/95 to-indigo-50/80 p-4 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-white shadow-xs">
                        <Timer size={18} className="animate-spin-slow" />
                      </span>
                      <div>
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700 block">
                          Opening Soon • Scheduled
                        </span>
                        <span className="text-xs text-slate-600 font-medium">
                          Starts: {formatDateTime(listing.startTime)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
                        Starts in
                      </span>
                      <span className="font-mono text-base font-black text-blue-900">
                        {timing.formattedTime}
                      </span>
                    </div>
                  </div>
                </div>
              ) : timing.isLive ? (
                <div
                  className={`rounded-xl border p-4 shadow-2xs ${timing.isEndingSoon
                    ? "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/70"
                    : "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/70"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`grid h-9 w-9 place-items-center rounded-xl text-white shadow-xs ${timing.isEndingSoon ? "bg-amber-600" : "bg-emerald-600"
                          }`}
                      >
                        <Clock size={18} />
                      </span>
                      <div>
                        <span
                          className={`text-[11px] font-extrabold uppercase tracking-wider block ${timing.isEndingSoon ? "text-amber-800" : "text-emerald-800"
                            }`}
                        >
                          {timing.isEndingSoon ? "Ending Soon" : "Live Auction Active"}
                        </span>
                        <span className="text-xs text-slate-600 font-medium">
                          Closes: {formatDateTime(listing.endTime)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider block ${timing.isEndingSoon ? "text-amber-700" : "text-emerald-700"
                          }`}
                      >
                        Time remaining
                      </span>
                      <span
                        className={`font-mono text-base font-black ${timing.isEndingSoon ? "text-amber-950" : "text-emerald-950"
                          }`}
                      >
                        {timing.formattedTime}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-100 p-4">
                  <div className="flex items-center justify-between text-slate-600 text-xs">
                    <span className="font-bold">Auction Closed</span>
                    <span>Ended on {formatDateTime(listing.endTime)}</span>
                  </div>
                </div>
              )}

              {/* Pricing Box */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 space-y-4">
                {listing.saleMode === "multi_unit_offer" ? (
                  <>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[13px] font-medium text-slate-600">Asking Price Per Unit</span>
                      <div className="text-2xl font-black text-[#0f172a]">
                        {formatCurrency(listing.askingPricePerUnit || 0)}{" "}
                        <span className="text-sm font-normal text-slate-500">/ {listing.unitName || "unit"}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-[12px] pt-3 border-t border-slate-200/60">
                      <div>
                        <span className="text-slate-500">Total Units Available:</span>
                        <div className="font-bold text-slate-900">{listing.totalQuantity} {listing.unitName || "units"}</div>
                      </div>
                      <div>
                        <span className="text-slate-500">Min Order Quantity:</span>
                        <div className="font-bold text-slate-900">{listing.minOrderQuantity || 1} {listing.unitName || "units"}</div>
                      </div>
                      {listing.maxOrderQuantity && (
                        <div>
                          <span className="text-slate-500">Max Order Quantity:</span>
                          <div className="font-bold text-slate-900">{listing.maxOrderQuantity} {listing.unitName || "units"}</div>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-500">Partial Allocation:</span>
                        <div className="font-bold text-emerald-700">{listing.allowPartialAllocation ? "Allowed" : "Full Lot Only"}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] font-medium text-slate-600">Asking Price</span>
                    <div className="text-3xl font-black text-[#0f172a]">
                      {formatCurrency(listing.askingPrice || 0)}
                    </div>
                  </div>
                )}
              </div>

              {/* Interactive Offer Card */}
              {listing.saleMode === "multi_unit_offer" ? (
                <MultiUnitOfferCard listing={listing} timing={timing} />
              ) : (
                <BuyerOfferCard listing={listing} timing={timing} />
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
