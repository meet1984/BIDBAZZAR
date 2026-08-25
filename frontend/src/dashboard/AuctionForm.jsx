import React, { useEffect, useState } from "react";
import {
  CircleAlert,
  LoaderCircle,
  Save,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import api from "../lib/api";
import { errorMessage } from "../lib/format";
import { useCategories } from "../hooks/useCategories";
import ListingImageUploader from "../components/ListingImageUploader";

const inputClass =
  "mt-1.5 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3.5 text-[14px] text-[#0f172a] outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10 disabled:cursor-not-allowed disabled:bg-slate-100";

function toLocalDatetimeString(dateValue) {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getDefaultStartsAt() {
  const d = new Date();
  return toLocalDatetimeString(d);
}

function getDefaultEndsAt() {
  const d = new Date(Date.now() + 48 * 60 * 60 * 1000);
  return toLocalDatetimeString(d);
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 flex items-start gap-1 text-[12px] leading-5 text-red-600">
      <CircleAlert className="mt-0.5 shrink-0" size={13} aria-hidden="true" />
      {message}
    </p>
  );
}

export default function AuctionForm({ listing, auction, onClose, onSuccess, isAdmin = false, _isAdmin = false }) {
  const isAdministrator = Boolean(isAdmin || _isAdmin);
  const targetListing = listing || auction;
  const isEditing = Boolean(targetListing?.id);

  const { categories, loading: categoriesLoading } = useCategories();

  const [saleMode, setSaleMode] = useState(
    targetListing?.saleMode || targetListing?.sale_mode || "negotiated_offer",
  );

  const [selectedCategoryId, setSelectedCategoryId] = useState(
    targetListing?.categoryId || targetListing?.category_id || "",
  );
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(
    targetListing?.subcategoryId || targetListing?.subcategory_id || "",
  );

  const [images, setImages] = useState([]);

  const [data, setData] = useState(() => {
    let initCond =
      targetListing?.condition ||
      targetListing?.item_condition ||
      targetListing?.itemCondition ||
      "new";
    initCond = initCond.toLowerCase().replace(" ", "-");
    if (!["new", "like-new", "used", "refurbished"].includes(initCond)) {
      initCond = "new";
    }

    return {
      title: targetListing?.title || "",
      description: targetListing?.description || "",
      condition: initCond,
      location: targetListing?.location || "",
      askingPrice: targetListing?.askingPrice ?? targetListing?.asking_price ?? "",
      currency: targetListing?.currency || "INR",
      startTime: toLocalDatetimeString(targetListing?.startTime || targetListing?.start_time) || getDefaultStartsAt(),
      endTime: toLocalDatetimeString(targetListing?.endTime || targetListing?.end_time) || getDefaultEndsAt(),
      offerSelectionDeadline: toLocalDatetimeString(targetListing?.offerSelectionDeadline) || "",
      reviewStatus: targetListing?.reviewStatus || targetListing?.workflowStatus || targetListing?.status || "draft",

      // Multi-unit fields
      totalQuantity: targetListing?.totalQuantity ?? targetListing?.total_quantity ?? "",
      unitName: targetListing?.unitName || targetListing?.unit_name || "unit",
      askingPricePerUnit: targetListing?.askingPricePerUnit ?? targetListing?.asking_price_per_unit ?? "",
      minOrderQuantity: targetListing?.minOrderQuantity ?? targetListing?.min_order_quantity ?? "1",
      maxOrderQuantity: targetListing?.maxOrderQuantity ?? targetListing?.max_order_quantity ?? "",
      quantityIncrement: targetListing?.quantityIncrement ?? targetListing?.quantity_increment ?? "1",
      allowPartialAllocation: targetListing?.allowPartialAllocation ?? targetListing?.allow_partial_allocation ?? true,
      minAcceptableUnitPrice: targetListing?.minAcceptableUnitPrice ?? targetListing?.min_acceptable_unit_price ?? "",
      buyerConfirmationDeadlineHours: targetListing?.buyerConfirmationDeadlineHours ?? targetListing?.buyer_confirmation_deadline_hours ?? "48",
    };
  });


  const draftKey = !isAdministrator ? `bidmylot_seller_draft_${targetListing?.id || "new"}` : null;
  const [savedDraft, setSavedDraft] = useState(null);

  const [subcategoriesList, setSubcategoriesList] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState("");
  const [formError, setFormError] = useState(null);
  const [errors, setErrors] = useState({});

  // Check for unsaved draft on mount
  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.data && (parsed.data.title || parsed.data.description || parsed.data.askingPrice || parsed.data.askingPricePerUnit)) {
          setSavedDraft(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, [draftKey]);

  // Debounced auto-save draft to sessionStorage
  useEffect(() => {
    if (!draftKey || isAdministrator) return;
    const timer = setTimeout(() => {
      try {
        const hasContent = Boolean(
          data.title?.trim() ||
          data.description?.trim() ||
          data.askingPrice ||
          data.askingPricePerUnit,
        );
        if (hasContent) {
          sessionStorage.setItem(
            draftKey,
            JSON.stringify({
              saleMode,
              selectedCategoryId,
              selectedSubcategoryId,
              data,
              savedAt: Date.now(),
            }),
          );
        }
      } catch {
        // ignore
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [draftKey, isAdministrator, saleMode, selectedCategoryId, selectedSubcategoryId, data]);

  const handleRestoreDraft = () => {
    if (!savedDraft) return;
    if (savedDraft.saleMode) setSaleMode(savedDraft.saleMode);
    if (savedDraft.selectedCategoryId) setSelectedCategoryId(savedDraft.selectedCategoryId);
    if (savedDraft.selectedSubcategoryId) setSelectedSubcategoryId(savedDraft.selectedSubcategoryId);
    if (savedDraft.data) {
      setData((prev) => ({ ...prev, ...savedDraft.data }));
    }
    setSavedDraft(null);
  };

  const handleDiscardDraft = () => {
    if (draftKey) {
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
    }
    setSavedDraft(null);
  };

  // Populate categories fallback selection if not set
  useEffect(() => {
    if (categories.length > 0 && !selectedCategoryId) {
      // Find category by string match if existing listing has name string
      const matchedCat = categories.find(
        (c) => c.name === targetListing?.category || c.id === targetListing?.categoryId,
      );
      if (matchedCat) {
        setSelectedCategoryId(matchedCat.id);
      } else {
        setSelectedCategoryId(categories[0].id);
      }
    }
  }, [categories, selectedCategoryId, targetListing]);

  // Update subcategories list when selected category changes
  useEffect(() => {
    if (!selectedCategoryId) {
      setSubcategoriesList([]);
      return;
    }
    const cat = categories.find((c) => Number(c.id) === Number(selectedCategoryId));
    if (cat && Array.isArray(cat.subcategories)) {
      setSubcategoriesList(cat.subcategories.filter((sc) => sc.isActive));
    } else {
      setSubcategoriesList([]);
    }
  }, [selectedCategoryId, categories]);

  // Fetch initial images for listing
  useEffect(() => {
    if (targetListing?.id) {
      api
        .get(`/seller/listings/${targetListing.id}/images`)
        .then((res) => setImages(res.data?.images || []))
        .catch(() => { });
    }
  }, [targetListing]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = () => {
    const nextErrors = {};
    if (!data.title.trim() || data.title.trim().length < 4) {
      nextErrors.title = "Title must be at least 4 characters.";
    }
    if (!selectedCategoryId) {
      nextErrors.categoryId = "Category selection is required.";
    }
    if (!data.description.trim() || data.description.trim().length < 20) {
      nextErrors.description = "Description must be at least 20 characters.";
    }
    if (!data.location.trim()) {
      nextErrors.location = "Location is required.";
    }
    if (!data.askingPrice || Number(data.askingPrice) < 0) {
      nextErrors.askingPrice = "Valid asking price is required.";
    }
    if (!data.startTime) {
      nextErrors.startTime = "Start time is required.";
    }
    if (!data.endTime) {
      nextErrors.endTime = "End time is required.";
    }
    if (data.startTime && data.endTime) {
      const minDurationMs = 48 * 60 * 60 * 1000;
      if (new Date(data.endTime).getTime() < new Date(data.startTime).getTime() + minDurationMs) {
        nextErrors.endTime = "Listing end time must be at least 48 hours after start time.";
      }
    }

    if (saleMode === "multi_unit_offer") {
      if (!data.totalQuantity || Number(data.totalQuantity) <= 0) {
        nextErrors.totalQuantity = "Total quantity must be greater than 0 for multi-unit offers.";
      }
      if (data.askingPricePerUnit === "" || Number(data.askingPricePerUnit) < 0) {
        nextErrors.askingPricePerUnit = "Valid asking price per unit is required.";
      }
      if (data.minOrderQuantity && data.maxOrderQuantity && Number(data.minOrderQuantity) > Number(data.maxOrderQuantity)) {
        nextErrors.maxOrderQuantity = "Maximum order quantity cannot be less than minimum order quantity.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (actionType = "save_draft") => {
    if (!validate()) return;

    setSubmitting(true);
    setSubmittingAction(actionType);
    setFormError(null);

    const payload = {
      saleMode,
      categoryId: Number(selectedCategoryId),
      subcategoryId: selectedSubcategoryId ? Number(selectedSubcategoryId) : null,
      title: data.title.trim(),
      description: data.description.trim(),
      condition: data.condition,
      location: data.location.trim(),
      askingPrice: Number(data.askingPrice),
      currency: data.currency,
      startTime: new Date(data.startTime).toISOString(),
      endTime: new Date(data.endTime).toISOString(),
      offerSelectionDeadline: data.offerSelectionDeadline ? new Date(data.offerSelectionDeadline).toISOString() : null,

      ...(isAdministrator && data.reviewStatus ? { reviewStatus: data.reviewStatus } : {}),

      ...(saleMode === "multi_unit_offer"
        ? {
          totalQuantity: Number(data.totalQuantity),
          unitName: data.unitName.trim() || "unit",
          askingPricePerUnit: Number(data.askingPricePerUnit),
          minOrderQuantity: data.minOrderQuantity ? Number(data.minOrderQuantity) : 1,
          maxOrderQuantity: data.maxOrderQuantity ? Number(data.maxOrderQuantity) : null,
          quantityIncrement: data.quantityIncrement ? Number(data.quantityIncrement) : 1,
          allowPartialAllocation: Boolean(data.allowPartialAllocation),
          minAcceptableUnitPrice: data.minAcceptableUnitPrice ? Number(data.minAcceptableUnitPrice) : null,
          buyerConfirmationDeadlineHours: data.buyerConfirmationDeadlineHours ? Number(data.buyerConfirmationDeadlineHours) : 48,
        }
        : {}),

    };

    try {
      let savedListing;
      if (isEditing) {
        const endpoint = isAdministrator ? `/admin/listings/${targetListing.id}` : `/seller/listings/${targetListing.id}`;
        const res = await api.patch(endpoint, payload);
        savedListing = res.data?.listing;
      } else {
        const res = await api.post("/seller/listings", payload);
        savedListing = res.data?.listing;
      }

      // Upload any pending image files selected during draft creation
      const pendingFiles = images.filter((img) => img.file instanceof File);
      if (pendingFiles.length > 0 && savedListing?.id) {
        const formData = new FormData();
        pendingFiles.forEach((img) => formData.append("images", img.file));
        await api.post(`/seller/listings/${savedListing.id}/images`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      // If publishing directly
      if (actionType === "publish" && savedListing?.id) {
        const subRes = await api.post(`/seller/listings/${savedListing.id}/submit`);
        savedListing = subRes.data?.listing;
      }

      if (draftKey) {
        try {
          sessionStorage.removeItem(draftKey);
        } catch {
          // ignore
        }
      }

      if (onSuccess) onSuccess(savedListing);
      if (onClose) onClose();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSubmitting(false);
      setSubmittingAction("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6 backdrop-blur-xs">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-white shrink-0">
          <div>
            <h2 className="text-xl font-bold text-[#0f172a]">
              {isEditing ? "Edit Marketplace Listing" : "Create New Marketplace Listing"}
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-500">
              Configure listing details, select sale mode, and manage specifications & images.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Unsaved Draft Banner */}
        {savedDraft && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-xs text-amber-900 shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-amber-600 shrink-0" />
              <span>
                Unsaved draft from previous session detected ({savedDraft.savedAt ? new Date(savedDraft.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "earlier"}).
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-700 transition shadow-2xs"
              >
                Restore Draft
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Sticky Sale Mode Selector Bar */}
        <div className="border-b border-slate-200/80 bg-slate-50/90 px-6 py-3.5 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              1. Choose Sale Mode
            </label>
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
              Current: {saleMode === "multi_unit_offer" ? "📦 Multi-Unit Wholesale Lot" : "🏷️ Single Negotiated Offer"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSaleMode("negotiated_offer")}
              className={`flex items-start gap-3 text-left rounded-xl border p-3 transition-all ${
                saleMode === "negotiated_offer"
                  ? "border-[#2563eb] bg-white ring-2 ring-[#2563eb]/20 shadow-xs"
                  : "border-slate-200 bg-white/70 hover:bg-white hover:border-slate-300"
              }`}
            >
              <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm ${
                saleMode === "negotiated_offer" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                🏷️
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0f172a]">Single Lot / Negotiated Offer</span>
                  <div className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${
                    saleMode === "negotiated_offer" ? "border-[#2563eb] bg-[#2563eb]" : "border-slate-300"
                  }`}>
                    {saleMode === "negotiated_offer" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                  Single item or bulk lot where buyers submit private price offers.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSaleMode("multi_unit_offer")}
              className={`flex items-start gap-3 text-left rounded-xl border p-3 transition-all ${
                saleMode === "multi_unit_offer"
                  ? "border-[#2563eb] bg-white ring-2 ring-[#2563eb]/20 shadow-xs"
                  : "border-slate-200 bg-white/70 hover:bg-white hover:border-slate-300"
              }`}
            >
              <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm ${
                saleMode === "multi_unit_offer" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                📦
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0f172a]">Multi-Unit Quantity Offer</span>
                  <div className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${
                    saleMode === "multi_unit_offer" ? "border-[#2563eb] bg-[#2563eb]" : "border-slate-300"
                  }`}>
                    {saleMode === "multi_unit_offer" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                  Multiple units in stock. Buyers request custom quantities & unit prices.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form className="flex-1 overflow-y-auto px-6 py-5 space-y-6" onSubmit={(e) => e.preventDefault()}>
          {formError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-[13px] text-red-700">
              <CircleAlert className="mt-0.5 shrink-0" size={16} />
              <div>{formError}</div>
            </div>
          )}

          {/* Admin Status Override Card */}
          {isAdministrator && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 text-xs space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-purple-950 uppercase tracking-wider text-xs flex items-center gap-1.5">
                  🛡️ Admin Status & Workflow Control
                </span>
                <span className="font-mono text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                  Admin Authority Active
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-1">
                <div>
                  <label htmlFor="reviewStatus" className="block text-[11px] font-bold text-slate-700 mb-1">
                    Listing Status:
                  </label>
                  <select
                    id="reviewStatus"
                    name="reviewStatus"
                    value={data.reviewStatus}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-purple-300 bg-white p-2 text-xs font-bold text-slate-900 outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-200"
                  >
                    <option value="approved">Approved / Live / Published</option>
                    <option value="sold">Sold (Monochrome)</option>
                    <option value="draft">Draft</option>
                    <option value="closed">Closed / Completed</option>
                    <option value="rejected">Rejected</option>
                    <option value="changes_requested">Changes Requested</option>
                  </select>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Administrators can change the listing status to any state (Live, Sold, Draft, Closed) and modify all specifications regardless of current status.
                </p>
              </div>
            </div>
          )}

          {/* Title & Categories */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label htmlFor="title" className="block text-[13px] font-semibold text-[#0f172a]">
                Listing Title *
              </label>
              <input
                id="title"
                name="title"
                type="text"
                value={data.title}
                onChange={handleChange}
                placeholder="e.g. 2024 Industrial CNC Milling Machine Lot"
                className={inputClass}
              />
              <FieldError id="title-error" message={errors.title} />
            </div>

            <div>
              <label htmlFor="categoryId" className="block text-[13px] font-semibold text-[#0f172a]">
                Category *
              </label>
              <select
                id="categoryId"
                value={selectedCategoryId}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value);
                  setSelectedSubcategoryId("");
                }}
                disabled={categoriesLoading}
                className={inputClass}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <FieldError id="cat-error" message={errors.categoryId} />
            </div>

            <div>
              <label htmlFor="subcategoryId" className="block text-[13px] font-semibold text-[#0f172a]">
                Subcategory
              </label>
              <select
                id="subcategoryId"
                value={selectedSubcategoryId}
                onChange={(e) => setSelectedSubcategoryId(e.target.value)}
                disabled={!subcategoriesList.length}
                className={inputClass}
              >
                <option value="">-- None / All --</option>
                {subcategoriesList.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="condition" className="block text-[13px] font-semibold text-[#0f172a]">
                Condition *
              </label>
              <select
                id="condition"
                name="condition"
                value={data.condition}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="new">Brand New</option>
                <option value="like-new">Like New</option>
                <option value="used">Used / Pre-owned</option>
                <option value="refurbished">Refurbished</option>
              </select>
            </div>
          </div>

          {/* Pricing & Mode Specific Fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="askingPrice" className="block text-[13px] font-semibold text-[#0f172a]">
                {saleMode === "multi_unit_offer" ? "Total Lot Value / Asking Price (INR) *" : "Asking Price (INR) *"}
              </label>
              <input
                id="askingPrice"
                name="askingPrice"
                type="number"
                min="0"
                value={data.askingPrice}
                onChange={handleChange}
                placeholder="150000"
                className={inputClass}
              />
              <FieldError id="price-error" message={errors.askingPrice} />
            </div>

            <div>
              <label htmlFor="location" className="block text-[13px] font-semibold text-[#0f172a]">
                Warehouse / Item Location *
              </label>
              <input
                id="location"
                name="location"
                type="text"
                value={data.location}
                onChange={handleChange}
                placeholder="e.g. Mumbai, Maharashtra"
                className={inputClass}
              />
              <FieldError id="loc-error" message={errors.location} />
            </div>

            <div>
              <label htmlFor="currency" className="block text-[13px] font-semibold text-[#0f172a]">
                Currency
              </label>
              <input
                id="currency"
                name="currency"
                type="text"
                value={data.currency}
                onChange={handleChange}
                disabled
                className={inputClass}
              />
            </div>
          </div>

          {/* Multi-Unit Quantity Fields */}
          {saleMode === "multi_unit_offer" && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-4">
              <h3 className="text-[14px] font-bold text-[#0f172a]">Multi-Unit Offer Settings</h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div>
                  <label htmlFor="totalQuantity" className="block text-[12px] font-semibold text-[#0f172a]">
                    Total Units Available *
                  </label>
                  <input
                    id="totalQuantity"
                    name="totalQuantity"
                    type="number"
                    min="1"
                    value={data.totalQuantity}
                    onChange={handleChange}
                    placeholder="100"
                    className={inputClass}
                  />
                  <FieldError id="tq-error" message={errors.totalQuantity} />
                </div>

                <div>
                  <label htmlFor="unitName" className="block text-[12px] font-semibold text-[#0f172a]">
                    Unit Name
                  </label>
                  <input
                    id="unitName"
                    name="unitName"
                    type="text"
                    value={data.unitName}
                    onChange={handleChange}
                    placeholder="piece, box, lot"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="askingPricePerUnit" className="block text-[12px] font-semibold text-[#0f172a]">
                    Asking Price Per Unit (INR) *
                  </label>
                  <input
                    id="askingPricePerUnit"
                    name="askingPricePerUnit"
                    type="number"
                    min="0"
                    value={data.askingPricePerUnit}
                    onChange={handleChange}
                    placeholder="1500"
                    className={inputClass}
                  />
                  <FieldError id="ppu-error" message={errors.askingPricePerUnit} />
                </div>

                <div>
                  <label htmlFor="minOrderQuantity" className="block text-[12px] font-semibold text-[#0f172a]">
                    Min Order Quantity
                  </label>
                  <input
                    id="minOrderQuantity"
                    name="minOrderQuantity"
                    type="number"
                    min="1"
                    value={data.minOrderQuantity}
                    onChange={handleChange}
                    placeholder="1"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="maxOrderQuantity" className="block text-[12px] font-semibold text-[#0f172a]">
                    Max Order Quantity (Optional)
                  </label>
                  <input
                    id="maxOrderQuantity"
                    name="maxOrderQuantity"
                    type="number"
                    min="1"
                    value={data.maxOrderQuantity}
                    onChange={handleChange}
                    placeholder="50"
                    className={inputClass}
                  />
                  <FieldError id="maq-error" message={errors.maxOrderQuantity} />
                </div>

                <div>
                  <label htmlFor="quantityIncrement" className="block text-[12px] font-semibold text-[#0f172a]">
                    Quantity Increment Step
                  </label>
                  <input
                    id="quantityIncrement"
                    name="quantityIncrement"
                    type="number"
                    min="1"
                    value={data.quantityIncrement}
                    onChange={handleChange}
                    placeholder="1"
                    className={inputClass}
                  />
                </div>

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer text-[13px] font-semibold text-[#0f172a]">
                    <input
                      type="checkbox"
                      name="allowPartialAllocation"
                      checked={data.allowPartialAllocation}
                      onChange={handleChange}
                      className="h-4 w-4 rounded text-[#2563eb]"
                    />
                    Allow Partial Allocation
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
                <div>
                  <label htmlFor="minAcceptableUnitPrice" className="flex items-center gap-1 text-[12px] font-semibold text-[#0f172a]">
                    <span>Private Minimum Acceptable Unit Price (INR)</span>
                  </label>
                  <input
                    id="minAcceptableUnitPrice"
                    name="minAcceptableUnitPrice"
                    type="number"
                    min="0"
                    value={data.minAcceptableUnitPrice}
                    onChange={handleChange}
                    placeholder="e.g. 1200 (Private Floor Price)"
                    className={inputClass}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Your confidential floor price per unit. Buyers will NEVER see this value.
                  </p>
                </div>

                <div>
                  <label htmlFor="buyerConfirmationDeadlineHours" className="block text-[12px] font-semibold text-[#0f172a]">
                    Buyer Confirmation Deadline (Hours)
                  </label>
                  <input
                    id="buyerConfirmationDeadlineHours"
                    name="buyerConfirmationDeadlineHours"
                    type="number"
                    min="1"
                    value={data.buyerConfirmationDeadlineHours}
                    onChange={handleChange}
                    placeholder="48"
                    className={inputClass}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Hours allocated buyers have to confirm their reservation before inventory is released back to stock.
                  </p>
                </div>
              </div>
            </div>
          )}


          {/* Timing */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="startTime" className="block text-[13px] font-semibold text-[#0f172a]">
                Listing Start Date & Time *
              </label>
              <input
                id="startTime"
                name="startTime"
                type="datetime-local"
                value={data.startTime}
                onChange={handleChange}
                className={inputClass}
              />
              <FieldError id="st-error" message={errors.startTime} />
            </div>

            <div>
              <label htmlFor="endTime" className="block text-[13px] font-semibold text-[#0f172a]">
                Listing End Date & Time (Min 48 hours duration) *
              </label>
              <input
                id="endTime"
                name="endTime"
                type="datetime-local"
                value={data.endTime}
                onChange={handleChange}
                className={inputClass}
              />
              <FieldError id="et-error" message={errors.endTime} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-[13px] font-semibold text-[#0f172a]">
              Listing Description & Technical Specifications *
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              value={data.description}
              onChange={handleChange}
              placeholder="Provide a comprehensive description of the lot, specifications, included accessories, and condition..."
              className="mt-1.5 w-full rounded-md border border-slate-300 bg-white p-3 text-[14px] text-[#0f172a] outline-none transition placeholder:text-slate-400 focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
            />
            <FieldError id="desc-error" message={errors.description} />
          </div>

          {/* Listing Image Gallery Uploader */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <ListingImageUploader
              listingId={targetListing?.id}
              images={images}
              onImagesChange={(updated) => setImages(updated)}
            />
          </div>
        </form>

        {/* Modal Sticky Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/80 px-6 py-3.5 shrink-0">
          <div className="text-[12px] text-slate-500 hidden sm:block font-medium">
            Mode: <span className="font-bold text-slate-800">{saleMode === "multi_unit_offer" ? "Multi-Unit Quantity Offer" : "Single Lot / Negotiated Offer"}</span>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit("save_draft")}
              className="inline-flex items-center gap-2 rounded-lg border border-[#2563eb] bg-white px-4 py-2 text-[13px] font-semibold text-[#2563eb] shadow-xs transition hover:bg-blue-50 disabled:opacity-50"
            >
              {submitting && submittingAction === "save_draft" ? (
                <LoaderCircle className="animate-spin" size={15} />
              ) : (
                <Save size={15} />
              )}
              Save Draft
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit("publish")}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2563eb] px-5 py-2 text-[13px] font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting && submittingAction === "publish" ? (
                <LoaderCircle className="animate-spin" size={15} />
              ) : (
                <Send size={15} />
              )}
              Publish Listing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
