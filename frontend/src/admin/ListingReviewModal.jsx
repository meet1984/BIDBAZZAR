import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  MapPin,
  Send,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import api from "../lib/api";
import { errorMessage, formatCurrency } from "../lib/format";

export function ListingReviewModal({ listing, onClose, onSuccess }) {
  const [decision, setDecision] = useState("approve");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Fetch image gallery for preview
  const [gallery, setGallery] = useState([]);

  useEffect(() => {
    if (!listing?.id) return;
    api
      .get(`/seller/listings/${listing.id}/images`)
      .then((res) => setGallery(res.data?.images || []))
      .catch(() => { });
  }, [listing]);

  // Is reason mandatory for selected decision?
  const isReasonMandatory = decision === "reject" || decision === "request_changes";
  const isReasonValid = !isReasonMandatory || reason.trim().length >= 4;

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!isReasonValid) {
      setError("A mandatory reason (at least 4 characters) is required when rejecting or requesting changes.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await api.patch(`/admin/listings/${listing.id}/review`, {
        decision,
        reason: reason.trim(),
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="relative my-8 w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-[#0f172a]">Admin Listing Review</h2>
              <span className="font-mono text-xs font-bold text-[#2563eb]">
                {listing.listingReference || `LOT-${listing.id}`}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Review seller listing submission, inspect sale mode parameters, and record decision audit log.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Listing Details & Gallery Preview */}
          <div className="lg:col-span-7 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Category: {listing.categoryName || listing.category?.name || "General"}</span>
                <span className="capitalize">Condition: {listing.condition?.replace("-", " ")}</span>
              </div>
              <h3 className="text-lg font-bold text-[#0f172a]">{listing.title}</h3>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><MapPin size={13} /> {listing.location}</span>
                <span>•</span>
                <span className="flex items-center gap-1 font-semibold text-emerald-700">
                  <ShieldCheck size={14} /> {listing.sellerName || "Verified Seller"}
                </span>
              </div>
            </div>

            {/* Gallery Grid */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-bold text-slate-700 mb-2">Uploaded Images ({gallery.length})</div>
              {gallery.length === 0 ? (
                <div className="relative aspect-[16/9] w-full flex items-center justify-center rounded-lg border border-dashed bg-white text-xs text-slate-400">
                  No images uploaded
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {gallery.map((img, i) => (
                    <div key={img.id || i} className="relative aspect-square w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <img src={img.imageUrl || img.url} alt={`Gallery ${i + 1}`} className="absolute inset-0 h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sale Mode & Pricing Details */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900">Sale Mode</span>
                <span className="rounded bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white uppercase">
                  {listing.saleMode === "multi_unit_offer" ? "Multi-Unit Offer" : "Negotiated Offer"}
                </span>
              </div>

              {listing.saleMode === "multi_unit_offer" ? (
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 text-slate-700 border-t border-blue-200/60">
                  <div><span className="text-slate-500">Unit Price:</span> <span className="font-bold">{formatCurrency(listing.askingPricePerUnit || 0)} / {listing.unitName || "unit"}</span></div>
                  <div><span className="text-slate-500">Total Units:</span> <span className="font-bold">{listing.totalQuantity}</span></div>
                  <div><span className="text-slate-500">Min Order:</span> <span className="font-bold">{listing.minOrderQuantity || 1}</span></div>
                  <div><span className="text-slate-500">Partial Allocation:</span> <span className="font-bold">{listing.allowPartialAllocation ? "Yes" : "No"}</span></div>
                </div>
              ) : (
                <div className="text-xs pt-2 text-slate-700">
                  <span className="text-slate-500">Asking Price:</span> <span className="font-extrabold text-sm">{formatCurrency(listing.askingPrice || 0)}</span>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-bold text-slate-700 mb-1">Seller Description</div>
              <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">{listing.description}</p>
            </div>
          </div>

          {/* Right Column: Decision Action Form */}
          <div className="lg:col-span-5 space-y-4">
            <form onSubmit={handleReviewSubmit} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
              <h4 className="text-sm font-bold text-[#0f172a]">Select Review Decision</h4>

              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer rounded-lg border p-3 text-xs font-bold transition hover:bg-slate-50">
                  <input
                    type="radio"
                    name="decision"
                    value="approve"
                    checked={decision === "approve"}
                    onChange={() => setDecision("approve")}
                    className="h-4 w-4 text-emerald-600"
                  />
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Approve Listing</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer rounded-lg border p-3 text-xs font-bold transition hover:bg-slate-50">
                  <input
                    type="radio"
                    name="decision"
                    value="request_changes"
                    checked={decision === "request_changes"}
                    onChange={() => setDecision("request_changes")}
                    className="h-4 w-4 text-purple-600"
                  />
                  <Info size={16} className="text-purple-600" />
                  <span>Request Changes from Seller</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer rounded-lg border p-3 text-xs font-bold transition hover:bg-slate-50">
                  <input
                    type="radio"
                    name="decision"
                    value="reject"
                    checked={decision === "reject"}
                    onChange={() => setDecision("reject")}
                    className="h-4 w-4 text-red-600"
                  />
                  <XCircle size={16} className="text-red-600" />
                  <span>Reject Submission</span>
                </label>
              </div>

              {/* Mandatory Reason Input */}
              {isReasonMandatory && (
                <div className="space-y-1.5 pt-2">
                  <label className="block text-xs font-bold text-[#0f172a]">
                    Mandatory Reason * <span className="text-[11px] font-normal text-slate-500">(Min 4 characters)</span>
                  </label>
                  <textarea
                    rows={4}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Provide specific feedback or explanation for the seller..."
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
                    required
                  />
                  {!isReasonValid && (
                    <p className="text-[11px] text-red-600 font-medium">
                      Reason must be at least 4 characters long.
                    </p>
                  )}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || !isReasonValid}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#2563eb] py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    "Recording Decision..."
                  ) : (
                    <>
                      <Send size={15} /> Confirm Decision & Record Audit Log
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
