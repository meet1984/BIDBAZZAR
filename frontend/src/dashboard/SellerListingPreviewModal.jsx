import React, { useEffect, useState } from "react";
import {
  Boxes,
  Clock,
  Eye,
  Info,
  MapPin,
  Pencil,
  ShieldCheck,
  Tag,
  X,
} from "lucide-react";
import api from "../lib/api";
import { formatCurrency } from "../lib/format";
import { resolveImageUrl } from "../lib/image";

export function SellerListingPreviewModal({ listing, onClose, onEdit }) {
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    if (!listing?.id) return;
    api
      .get(`/seller/listings/${listing.id}/images`)
      .then((res) => {
        const imgs = res.data?.images || [];
        setImages(imgs);
      })
      .catch(() => { });
  }, [listing]);

  if (!listing) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="relative my-8 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
        {/* Top Preview Banner */}
        <div className="mb-6 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs font-semibold text-blue-900">
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-[#2563eb]" />
            <span>
              <b>Preview Mode</b> — This is how your listing will appear to buyers once approved and live.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Title & Header info */}
        <div className="space-y-2 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded bg-blue-50 border border-blue-100 px-2.5 py-0.5 font-mono text-xs font-bold text-[#2563eb]">
              {listing.listingReference || `LOT-${listing.id}`}
            </span>
            <span className="rounded bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
              {listing.category?.name || listing.categoryName || "General"}
            </span>
            {listing.subcategory?.name && (
              <span className="rounded bg-slate-50 border border-slate-200 px-2 py-0.5 text-xs text-slate-600">
                {listing.subcategory.name}
              </span>
            )}
            <span className="rounded bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-800 capitalize">
              {listing.condition?.replace("-", " ") || "Used"}
            </span>
          </div>

          <h2 className="text-xl font-extrabold text-[#0f172a]">{listing.title}</h2>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <MapPin size={14} className="text-slate-400" /> {listing.location}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
              <ShieldCheck size={14} /> Verified Seller
            </span>
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-12">
          {/* Left Column: Image Gallery */}
          <div className="md:col-span-6 space-y-3">
            <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center">
              {images.length > 0 ? (
                <img
                  src={resolveImageUrl(images[selectedImage]?.imageUrl || images[selectedImage]?.url)}
                  alt={listing.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="text-xs text-slate-400 flex flex-col items-center gap-2">
                  <Info size={24} /> No images uploaded yet
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={img.id || idx}
                    type="button"
                    onClick={() => setSelectedImage(idx)}
                    className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition ${selectedImage === idx ? "border-[#2563eb]" : "border-transparent opacity-70"
                      }`}
                  >
                    <img src={resolveImageUrl(img.imageUrl || img.url)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Pricing & Commercial Spec */}
          <div className="md:col-span-6 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-slate-400 tracking-wider">
                  Pricing & Sale Mode
                </span>
                {listing.saleMode === "multi_unit_offer" ? (
                  <span className="inline-flex items-center gap-1 rounded bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-800">
                    <Boxes size={12} /> Multi-Unit Quantity
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                    <Tag size={12} /> Negotiated Offer
                  </span>
                )}
              </div>

              {listing.saleMode === "multi_unit_offer" ? (
                <div className="space-y-2 pt-1 border-t border-slate-200">
                  <div className="text-2xl font-black text-[#0f172a]">
                    {formatCurrency(listing.askingPricePerUnit || 0)}{" "}
                    <span className="text-xs font-normal text-slate-500">/ {listing.unitName || "unit"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                    <div>
                      <span className="text-slate-400">Total Units:</span>{" "}
                      <b className="text-slate-800">{listing.totalQuantity || 1}</b>
                    </div>
                    <div>
                      <span className="text-slate-400">Min Order:</span>{" "}
                      <b className="text-slate-800">{listing.minOrderQuantity || 1}</b>
                    </div>
                    {listing.maxOrderQuantity && (
                      <div>
                        <span className="text-slate-400">Max Order:</span>{" "}
                        <b className="text-slate-800">{listing.maxOrderQuantity}</b>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-400">Partial Lot:</span>{" "}
                      <b className="text-slate-800">{listing.allowPartialAllocation ? "Allowed" : "Full Lot Only"}</b>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 pt-1 border-t border-slate-200">
                  <span className="text-xs text-slate-500">Asking / Reserve Price</span>
                  <div className="text-2xl font-black text-[#0f172a]">
                    {formatCurrency(listing.askingPrice || 0)}
                  </div>
                </div>
              )}
            </div>

            {/* Offer Submission Notice Box */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Clock size={14} className="text-amber-700" /> Offer Submission Notice
              </div>
              <p className="text-amber-800/90 leading-relaxed">
                Buyers will be able to submit negotiated offers once this listing is reviewed and approved by marketplace administrators.
              </p>
            </div>
          </div>
        </div>

        {/* Full Description Section */}
        <div className="mt-6 border-t border-slate-100 pt-4">
          <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider mb-2">Item Description</h4>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700 leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto">
            {listing.description || "No description provided."}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          {onEdit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(listing);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-bold text-[#2563eb] hover:bg-blue-100 transition-colors"
            >
              <Pencil size={15} /> Edit Listing Details
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
