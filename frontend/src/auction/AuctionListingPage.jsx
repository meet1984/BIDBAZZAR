import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Boxes,
  Check,
  Clock,
  Heart,
  History,
  LayoutGrid,
  List,
  Lock,
  MapPin,
  Package,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Timer,
  X,
} from "lucide-react";
import api from "../lib/api";
import { formatCurrency } from "../lib/format";
import { resolveImageUrl } from "../lib/image";
import { useCategories } from "../hooks/useCategories";
import { useAuctionTiming } from "../hooks/useCountdown";
import { Footer, Navbar } from "../components";
import { useAuth } from "../auth/AuthContext";

export function StatusBadge({ status, isOpeningSoon, isClosed }) {
  if (isClosed || status === "closed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-slate-200 shadow-xs backdrop-blur-xs">
        <Lock size={11} className="text-slate-400" /> Closed
      </span>
    );
  }

  if (status === "upcoming" || isOpeningSoon) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/90 bg-blue-50/95 px-2.5 py-1 text-[11px] font-bold text-blue-700 shadow-xs backdrop-blur-xs">
        <Timer size={12} className="animate-spin-slow text-blue-600" />
        Opening Soon
      </span>
    );
  }

  if (status === "ending-soon") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/90 bg-amber-50/95 px-2.5 py-1 text-[11px] font-bold text-amber-800 shadow-xs backdrop-blur-xs">
        <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
        Ending Soon
      </span>
    );
  }

  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/90 bg-emerald-50/95 px-2.5 py-1 text-[11px] font-bold text-emerald-800 shadow-xs backdrop-blur-xs">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Live Now
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-slate-200 shadow-xs backdrop-blur-xs">
      <Lock size={11} className="text-slate-400" /> Closed
    </span>
  );
}

export function SaleModeBadge({ saleMode }) {
  if (saleMode === "multi_unit_offer") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200/80 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 shadow-2xs">
        <Boxes size={12} /> Multi-Unit Lot
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-2xs">
      <Tag size={12} /> Negotiated Offer
    </span>
  );
}

export function ListingCard({ item, viewMode = "grid" }) {
  const { user } = useAuth();
  const [watched, setWatched] = useState(Boolean(item.isWatched));
  const [savingWatch, setSavingWatch] = useState(false);

  const timing = useAuctionTiming(item.startTime, item.endTime, item.status);
  const isUpcoming = timing.isUpcoming;
  const isClosed = timing.isClosed || item.status === "closed";

  useEffect(() => {
    setWatched(Boolean(item.isWatched));
  }, [item.isWatched]);

  const toggleWatchlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      window.location.assign(`/login?returnTo=${encodeURIComponent(`/auctions/${item.publicSlug || item.id}`)}`);
      return;
    }
    if (user.role !== "buyer" && user.accountType !== "buyer") {
      alert("Only verified buyer accounts can save listings to a watchlist.");
      return;
    }

    setSavingWatch(true);
    try {
      const res = watched
        ? await api.delete(`/watchlist/${item.id}`)
        : await api.post(`/watchlist/${item.id}`);
      setWatched(Boolean(res.data?.watched));
    } catch {
      // optimistic fallback
      setWatched((prev) => !prev);
    } finally {
      setSavingWatch(false);
    }
  };

  const remainingQty = item.remainingInventory ?? item.totalQuantity;
  const totalQty = item.totalQuantity || 1;
  const stockPercentage = Math.min(100, Math.max(0, Math.round((remainingQty / totalQty) * 100)));

  if (viewMode === "list") {
    return (
      <div
        className={`group relative flex flex-col overflow-hidden rounded-2xl border shadow-xs transition-all duration-300 hover:-translate-y-0.5 sm:flex-row ${
          isClosed
            ? "border-slate-300 bg-slate-50/90 hover:border-slate-400 hover:shadow-md"
            : "border-slate-200/90 bg-white hover:border-blue-300 hover:shadow-lg"
        }`}
      >
        {/* List Thumbnail */}
        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-slate-100 sm:w-72 sm:min-h-[220px]">
          <img
            src={resolveImageUrl(item.imageUrl || item.thumbnailUrl)}
            alt={item.title}
            className={`absolute inset-0 h-full w-full object-cover transition duration-500 ${
              isClosed
                ? "grayscale contrast-125 opacity-75 group-hover:grayscale-0 group-hover:opacity-100"
                : "group-hover:scale-105"
            }`}
            loading="lazy"
          />
          <div
            className={`absolute inset-0 pointer-events-none ${
              isClosed
                ? "bg-slate-950/35"
                : "bg-gradient-to-t from-slate-950/40 via-transparent to-transparent"
            }`}
          />

          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            <StatusBadge status={item.status} isOpeningSoon={isUpcoming} isClosed={isClosed} />
            <SaleModeBadge saleMode={item.saleMode} />
          </div>

          <button
            type="button"
            onClick={toggleWatchlist}
            disabled={savingWatch}
            aria-label="Save to watchlist"
            className={`absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border backdrop-blur-xs transition ${
              watched
                ? "border-red-200 bg-white/95 text-red-600 shadow-md scale-105"
                : "border-white/70 bg-white/85 text-slate-600 hover:bg-white hover:text-slate-900"
            }`}
          >
            <Heart size={16} fill={watched ? "currentColor" : "none"} />
          </button>
        </div>

        {/* List Body */}
        <div className="flex flex-1 flex-col justify-between p-5">
          <div>
            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500">
              <div className="flex items-center gap-1.5">
                <span
                  className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                    isClosed
                      ? "text-slate-600 bg-slate-200 border-slate-300"
                      : "text-blue-600 bg-blue-50 border-blue-100"
                  }`}
                >
                  {item.listingReference || `LOT-${item.id}`}
                </span>
                <span>•</span>
                <span>{item.category?.name || "General"}</span>
                {item.subcategory?.name && (
                  <>
                    <span>/</span>
                    <span className="text-slate-700">{item.subcategory.name}</span>
                  </>
                )}
              </div>

              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${isClosed ? "text-slate-500" : "text-emerald-700"}`}>
                <ShieldCheck size={14} /> Verified Seller
              </span>
            </div>

            <h3
              className={`mt-2 text-lg font-bold line-clamp-1 transition-colors ${
                isClosed
                  ? "text-slate-700 group-hover:text-slate-900"
                  : "text-slate-900 group-hover:text-blue-600"
              }`}
            >
              <a href={`/auctions/${item.publicSlug || item.id}`}>{item.title}</a>
            </h3>

            <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
              {item.description || "No description provided."}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1">
                <MapPin size={13} className="text-slate-400" /> {item.location || "India"}
              </span>
              <span>•</span>
              <span className="capitalize">{item.condition?.replace("-", " ") || "New"}</span>

              {item.saleMode === "multi_unit_offer" && (
                <>
                  <span>•</span>
                  <span className="text-slate-700 font-medium">
                    Stock: {remainingQty} / {totalQty} {item.unitName || "units"}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 pt-3 gap-3">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {isClosed
                  ? "Final Bid / Asking"
                  : item.saleMode === "multi_unit_offer"
                    ? "Asking Unit Price"
                    : "Asking Price"}
              </span>
              <div
                className={`text-xl font-extrabold ${
                  isClosed ? "text-slate-600" : "text-slate-900"
                }`}
              >
                {item.saleMode === "multi_unit_offer"
                  ? `${formatCurrency(item.askingPricePerUnit || 0)} / ${item.unitName || "unit"}`
                  : formatCurrency(item.askingPrice || 0)}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                  {timing.countdownLabel}
                </span>
                <div
                  className={`font-mono text-xs font-bold ${
                    isClosed
                      ? "text-slate-500"
                      : isUpcoming
                        ? "text-blue-600"
                        : timing.isEndingSoon
                          ? "text-amber-600"
                          : "text-emerald-700"
                  }`}
                >
                  {timing.formattedTime}
                </div>
              </div>

              <a
                href={`/auctions/${item.publicSlug || item.id}`}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all shadow-xs ${
                  isClosed
                    ? "bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-900"
                    : isUpcoming
                      ? "bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100"
                      : "bg-[#2563eb] text-white hover:bg-blue-700 hover:shadow-md"
                }`}
              >
                {isClosed ? "View Archive" : isUpcoming ? "Preview Lot" : "Submit Offer"}
                <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grid Card
  return (
    <div
      className={`group relative flex flex-col h-full overflow-hidden rounded-2xl border shadow-xs transition-all duration-300 hover:-translate-y-1 ${
        isClosed
          ? "border-slate-300 bg-slate-50/90 hover:border-slate-400 hover:shadow-md"
          : "border-slate-200/90 bg-white hover:border-blue-300 hover:shadow-lg"
      }`}
    >
      {/* Thumbnail Area */}
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-slate-100">
        <img
          src={resolveImageUrl(item.imageUrl || item.thumbnailUrl)}
          alt={item.title}
          className={`absolute inset-0 h-full w-full object-cover transition duration-500 ${
            isClosed
              ? "grayscale contrast-125 opacity-75 group-hover:grayscale-0 group-hover:opacity-100"
              : "group-hover:scale-105"
          }`}
          loading="lazy"
        />
        <div
          className={`absolute inset-0 pointer-events-none ${
            isClosed
              ? "bg-slate-950/35"
              : "bg-gradient-to-t from-slate-950/45 via-transparent to-transparent"
          }`}
        />

        {/* Status & Mode Badges */}
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5 max-w-[80%]">
          <StatusBadge status={item.status} isOpeningSoon={isUpcoming} isClosed={isClosed} />
          <SaleModeBadge saleMode={item.saleMode} />
        </div>

        {/* Watchlist Bookmark */}
        <button
          type="button"
          onClick={toggleWatchlist}
          disabled={savingWatch}
          aria-label="Save to watchlist"
          className={`absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full border backdrop-blur-xs transition ${
            watched
              ? "border-red-200 bg-white/95 text-red-600 shadow-md scale-105"
              : "border-white/70 bg-white/80 text-slate-600 hover:bg-white hover:text-slate-900"
          }`}
        >
          <Heart size={15} fill={watched ? "currentColor" : "none"} />
        </button>

        {/* Timing Overlay Bar at bottom of thumbnail */}
        <div
          className={`absolute inset-x-0 bottom-0 flex items-center justify-between px-3 py-1.5 backdrop-blur-xs text-[11px] ${
            isClosed
              ? "bg-slate-900/90 text-slate-300 font-mono"
              : "bg-slate-950/65 text-white"
          }`}
        >
          <span className={isClosed ? "text-slate-400 font-medium" : "text-slate-300 font-medium"}>
            {timing.countdownLabel}:
          </span>
          <span
            className={`font-mono font-bold ${
              isClosed
                ? "text-slate-300"
                : isUpcoming
                  ? "text-blue-300"
                  : timing.isEndingSoon
                    ? "text-amber-300"
                    : "text-emerald-300"
            }`}
          >
            {timing.formattedTime}
          </span>
        </div>
      </div>

      {/* Card Content */}
      <div className="flex flex-1 flex-col justify-between p-4">
        {/* Category & LOT Ref */}
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
          <span className="truncate max-w-[140px]">
            {item.category?.name || "General"}
            {item.subcategory?.name && ` • ${item.subcategory.name}`}
          </span>
          <span className="font-mono text-[10px] font-bold text-slate-400">
            {item.listingReference || `LOT-${item.id}`}
          </span>
        </div>

        {/* Title */}
        <h3
          className={`mt-1.5 text-[15px] font-bold leading-snug line-clamp-2 min-h-[42px] transition-colors ${
            isClosed
              ? "text-slate-700 group-hover:text-slate-900"
              : "text-slate-900 group-hover:text-blue-600"
          }`}
        >
          <a href={`/auctions/${item.publicSlug || item.id}`}>{item.title}</a>
        </h3>

        {/* Metadata pills */}
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1 truncate">
            <MapPin size={12} className="text-slate-400" /> {item.location || "India"}
          </span>
          <span className="capitalize font-medium text-slate-600">
            {item.condition?.replace("-", " ") || "New"}
          </span>
        </div>

        {/* Multi-Unit Inventory Stock Indicator */}
        {item.saleMode === "multi_unit_offer" && (
          <div className="mt-3 rounded-lg bg-slate-50 p-2 border border-slate-100">
            <div className="flex justify-between text-[10px] text-slate-600 font-medium mb-1">
              <span>Stock Remaining</span>
              <span className="font-bold text-slate-900">
                {remainingQty} / {totalQty} {item.unitName || "units"}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isClosed ? "bg-slate-400" : stockPercentage < 25 ? "bg-amber-500" : "bg-blue-600"
                }`}
                style={{ width: `${stockPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Price & Action Section */}
        <div className="mt-auto pt-3 border-t border-slate-100 flex items-end justify-between gap-2">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
              {isClosed
                ? "Final / Asking"
                : item.saleMode === "multi_unit_offer"
                  ? "Unit Price"
                  : "Asking Price"}
            </span>
            <div
              className={`text-base font-black ${
                isClosed ? "text-slate-600" : "text-slate-900"
              }`}
            >
              {item.saleMode === "multi_unit_offer"
                ? `${formatCurrency(item.askingPricePerUnit || 0)}`
                : formatCurrency(item.askingPrice || 0)}
              {item.saleMode === "multi_unit_offer" && (
                <span className="text-[11px] font-normal text-slate-500"> /{item.unitName || "u"}</span>
              )}
            </div>
          </div>

          <a
            href={`/auctions/${item.publicSlug || item.id}`}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all shadow-2xs ${
              isClosed
                ? "bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-900"
                : isUpcoming
                  ? "bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100"
                  : "bg-[#2563eb] text-white hover:bg-blue-700"
            }`}
          >
            {isClosed ? "Closed" : isUpcoming ? "Opening Soon" : "Offer"}
            <ArrowRight size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}

const PRICE_PRESETS = [
  { label: "Under ₹25k", min: 0, max: 25000 },
  { label: "₹25k - ₹1 Lakh", min: 25000, max: 100000 },
  { label: "₹1L - ₹5 Lakh", min: 100000, max: 500000 },
  { label: "₹5 Lakh+", min: 500000, max: "" },
];

const CONDITIONS = [
  { id: "new", label: "Brand New" },
  { id: "like-new", label: "Like New" },
  { id: "used", label: "Used / Pre-owned" },
  { id: "refurbished", label: "Refurbished" },
];

export default function AuctionListingPage() {
  const { categories } = useCategories();
  const initialQuery = new URLSearchParams(window.location.search);

  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(Number(initialQuery.get("page")) || 1);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [search, setSearch] = useState(initialQuery.get("q") || "");
  const [statusFilter, setStatusFilter] = useState(initialQuery.get("status") || "active");
  const [selectedCategory, setSelectedCategory] = useState(initialQuery.get("category") || "");
  const [selectedSubcategory, setSelectedSubcategory] = useState(initialQuery.get("subcategory") || "");
  const [saleMode, setSaleModeFilter] = useState(initialQuery.get("saleMode") || "");
  const [conditionFilter, setConditionFilter] = useState(initialQuery.get("condition") ? initialQuery.get("condition").split(",") : []);
  const [minPrice, setMinPrice] = useState(initialQuery.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(initialQuery.get("maxPrice") || "");
  const [locationQuery, setLocationQuery] = useState(initialQuery.get("location") || "");
  const [sort, setSort] = useState(initialQuery.get("sort") || "recommended");

  // UI state
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem("bidmylot_view_mode") || "grid";
    } catch {
      return "grid";
    }
  });

  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const raw = localStorage.getItem("bidmylot_recent_searches");
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  });

  const [recentlyViewed, setRecentlyViewed] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("bidmylot_recently_viewed");
      const list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list)) setRecentlyViewed(list);
    } catch {
      // ignore
    }
  }, []);

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem("bidmylot_view_mode", mode);
    } catch {
      // ignore
    }
  };

  const handleSaveSearch = (query) => {
    const q = (query || "").trim();
    if (!q || q.length < 2) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== q.toLowerCase());
      const next = [q, ...filtered].slice(0, 8);
      try {
        localStorage.setItem("bidmylot_recent_searches", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleClearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem("bidmylot_recent_searches");
    } catch {
      // ignore
    }
  };

  const activeCategoryObj = categories.find(
    (c) => c.slug === selectedCategory || String(c.id) === selectedCategory,
  );
  const subcategories = activeCategoryObj?.subcategories || [];

  const fetchListings = useCallback(async () => {
    setLoading(true);
    if (search.trim()) {
      handleSaveSearch(search.trim());
    }
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (selectedCategory) params.set("category", selectedCategory);
      if (selectedSubcategory) params.set("subcategory", selectedSubcategory);
      if (saleMode) params.set("saleMode", saleMode);
      if (conditionFilter.length > 0) params.set("condition", conditionFilter.join(","));
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (locationQuery.trim()) params.set("location", locationQuery.trim());
      if (sort) params.set("sort", sort);
      params.set("page", String(currentPage));
      params.set("pageSize", "12");

      const res = await api.get(`/listings?${params.toString()}`);
      setItems(res.data?.items || []);
      setTotalCount(res.data?.total || 0);
      setTotalPages(res.data?.totalPages || 1);

      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    } catch {
      setItems([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [
    search,
    statusFilter,
    selectedCategory,
    selectedSubcategory,
    saleMode,
    conditionFilter,
    minPrice,
    maxPrice,
    locationQuery,
    sort,
    currentPage,
  ]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("active");
    setSelectedCategory("");
    setSelectedSubcategory("");
    setSaleModeFilter("");
    setConditionFilter([]);
    setMinPrice("");
    setMaxPrice("");
    setLocationQuery("");
    setSort("recommended");
    setCurrentPage(1);
  };

  const handleApplyPreset = (preset) => {
    setMinPrice(preset.min !== "" ? String(preset.min) : "");
    setMaxPrice(preset.max !== "" ? String(preset.max) : "");
    setCurrentPage(1);
  };

  const toggleCondition = (condId) => {
    setConditionFilter((prev) =>
      prev.includes(condId) ? prev.filter((c) => c !== condId) : [...prev, condId],
    );
    setCurrentPage(1);
  };

  // Compute active filters count
  const activeFiltersCount =
    (statusFilter !== "active" && statusFilter !== "all" ? 1 : 0) +
    (selectedCategory ? 1 : 0) +
    (selectedSubcategory ? 1 : 0) +
    (saleMode ? 1 : 0) +
    conditionFilter.length +
    (minPrice || maxPrice ? 1 : 0) +
    (locationQuery ? 1 : 0) +
    (search ? 1 : 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-500 selection:text-white">
      <Navbar />

      {/* Hero Header Section */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 mb-2">
                <Sparkles size={13} /> Official B2B & Verified Lots Marketplace
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                Marketplace Lots & Auctions
              </h1>
              <p className="mt-1 text-sm text-slate-600 max-w-2xl">
                Browse verified seller listings, opening soon auctions, private negotiated offers, and wholesale multi-unit lots.
              </p>
            </div>

            {/* Quick Metrics Bar */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-center shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Lots</span>
                <p className="text-base font-extrabold text-slate-900">{totalCount}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-center shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Live Lots</span>
                <p className="text-base font-extrabold text-emerald-900">
                  {items.filter((i) => i.status === "live" || i.status === "ending-soon").length}
                </p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-2 text-center shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Opening Soon</span>
                <p className="text-base font-extrabold text-blue-900">
                  {items.filter((i) => i.status === "upcoming" || new Date(i.startTime).getTime() > Date.now()).length}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Status Pill Bar */}
          <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {[
              { id: "active", label: "✨ All Active Lots", icon: Sparkles, color: "text-blue-600" },
              { id: "live", label: "🟢 Live Now", icon: Sparkles, color: "text-emerald-600" },
              { id: "upcoming", label: "⏱️ Opening Soon", icon: Timer, color: "text-blue-600" },
              { id: "ending-soon", label: "⏳ Ending Soon", icon: Clock, color: "text-amber-600" },
              { id: "closed", label: "🔒 Closed Lots (Archived)", icon: Lock, color: "text-slate-500" },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setCurrentPage(1);
                  }}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shadow-2xs ${
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <Icon size={14} className={isActive ? "text-white" : tab.color} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Main Search & Control Bar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && search.trim()) {
                    handleSaveSearch(search.trim());
                  }
                }}
                placeholder="Search by lot title, category, location, or LOT reference..."
                className="w-full rounded-xl border border-slate-200 pl-10 pr-10 py-2.5 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Quick Dropdown Selectors */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Sale Mode */}
              <select
                value={saleMode}
                onChange={(e) => {
                  setSaleModeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none hover:border-slate-300"
              >
                <option value="">All Sale Modes</option>
                <option value="negotiated_offer">Negotiated Offer</option>
                <option value="multi_unit_offer">Multi-Unit Offer</option>
              </select>

              {/* Category */}
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedSubcategory("");
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none hover:border-slate-300"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug || String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Subcategory */}
              {subcategories.length > 0 && (
                <select
                  value={selectedSubcategory}
                  onChange={(e) => {
                    setSelectedSubcategory(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none hover:border-slate-300"
                >
                  <option value="">All Subcategories</option>
                  {subcategories.map((sc) => (
                    <option key={sc.id} value={sc.slug || String(sc.id)}>
                      {sc.name}
                    </option>
                  ))}
                </select>
              )}

              {/* Sorting */}
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none hover:border-slate-300"
              >
                <option value="recommended">Sort: Recommended</option>
                <option value="starting-soon">Sort: Starting Soonest (Opening Soon)</option>
                <option value="ending-soon">Sort: Ending Soonest</option>
                <option value="newly-listed">Sort: Newly Listed</option>
                <option value="price-low">Sort: Price Low to High</option>
                <option value="price-high">Sort: Price High to Low</option>
              </select>

              {/* Filter Drawer Toggle */}
              <button
                type="button"
                onClick={() => setShowFiltersDrawer((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                  showFiltersDrawer || activeFiltersCount > 0
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <SlidersHorizontal size={14} />
                Filters
                {activeFiltersCount > 0 && (
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-blue-600 text-[10px] text-white">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {/* View Mode Toggle */}
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5">
                <button
                  type="button"
                  onClick={() => handleSetViewMode("grid")}
                  aria-label="Grid View"
                  className={`rounded-lg p-1.5 transition ${
                    viewMode === "grid" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => handleSetViewMode("list")}
                  aria-label="List View"
                  className={`rounded-lg p-1.5 transition ${
                    viewMode === "list" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Recent Searches Chips */}
          {recentSearches.length > 0 && !search && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs border-t border-slate-100">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <History size={12} /> Recent searches:
              </span>
              {recentSearches.map((term, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setSearch(term);
                    setCurrentPage(1);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition"
                >
                  {term}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClearRecentSearches}
                className="text-[11px] font-semibold text-slate-400 hover:text-red-600 transition ml-1"
              >
                Clear
              </button>
            </div>
          )}

          {/* Expandable Advanced Filter Panel */}
          {showFiltersDrawer && (
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Price Range */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">Price Range (₹)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Min INR"
                      value={minPrice}
                      onChange={(e) => {
                        setMinPrice(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full rounded-lg border border-slate-200 p-2 text-xs font-medium outline-none focus:border-blue-500"
                    />
                    <span className="text-slate-400 text-xs">to</span>
                    <input
                      type="number"
                      placeholder="Max INR"
                      value={maxPrice}
                      onChange={(e) => {
                        setMaxPrice(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full rounded-lg border border-slate-200 p-2 text-xs font-medium outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Price Presets */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {PRICE_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleApplyPreset(p)}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Condition Filter */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">Item Condition</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CONDITIONS.map((cond) => {
                      const isSelected = conditionFilter.includes(cond.id);
                      return (
                        <button
                          key={cond.id}
                          type="button"
                          onClick={() => toggleCondition(cond.id)}
                          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-left transition ${
                            isSelected
                              ? "border-blue-300 bg-blue-50 text-blue-700"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <div
                            className={`grid h-3.5 w-3.5 place-items-center rounded border ${
                              isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"
                            }`}
                          >
                            {isSelected && <Check size={10} />}
                          </div>
                          <span className="truncate">{cond.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Location Search */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">Location / City</label>
                  <div className="relative">
                    <MapPin className="absolute left-2.5 top-2.5 text-slate-400" size={15} />
                    <input
                      type="text"
                      placeholder="e.g. Mumbai, Delhi, Bengaluru..."
                      value={locationQuery}
                      onChange={(e) => {
                        setLocationQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-2 text-xs font-medium outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Reset Action */}
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-red-600 transition"
                >
                  <RotateCcw size={13} /> Reset All Filters
                </button>
              </div>
            </div>
          )}

          {/* Active Filter Chips Bar */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-400 font-medium">Active filters:</span>

              {statusFilter !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 font-bold text-blue-700">
                  Status: {statusFilter.replace("-", " ")}
                  <button type="button" onClick={() => setStatusFilter("all")}>
                    <X size={12} />
                  </button>
                </span>
              )}

              {selectedCategory && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 font-bold text-blue-700">
                  Category: {activeCategoryObj?.name || selectedCategory}
                  <button type="button" onClick={() => setSelectedCategory("")}>
                    <X size={12} />
                  </button>
                </span>
              )}

              {selectedSubcategory && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 font-bold text-blue-700">
                  Subcategory: {selectedSubcategory}
                  <button type="button" onClick={() => setSelectedSubcategory("")}>
                    <X size={12} />
                  </button>
                </span>
              )}

              {saleMode && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 font-bold text-blue-700">
                  Sale Mode: {saleMode.replace("_", " ")}
                  <button type="button" onClick={() => setSaleModeFilter("")}>
                    <X size={12} />
                  </button>
                </span>
              )}

              {conditionFilter.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 font-bold text-blue-700"
                >
                  Condition: {c}
                  <button type="button" onClick={() => toggleCondition(c)}>
                    <X size={12} />
                  </button>
                </span>
              ))}

              {(minPrice || maxPrice) && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 font-bold text-blue-700">
                  Price: ₹{minPrice || 0} - ₹{maxPrice || "∞"}
                  <button
                    type="button"
                    onClick={() => {
                      setMinPrice("");
                      setMaxPrice("");
                    }}
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {locationQuery && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 font-bold text-blue-700">
                  Location: {locationQuery}
                  <button type="button" onClick={() => setLocationQuery("")}>
                    <X size={12} />
                  </button>
                </span>
              )}

              {search && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 font-bold text-blue-700">
                  Search: "{search}"
                  <button type="button" onClick={() => setSearch("")}>
                    <X size={12} />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-bold text-red-600 hover:underline ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Results Header */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-500">
          <span>
            Showing <strong className="text-slate-900">{items.length}</strong> of{" "}
            <strong className="text-slate-900">{totalCount}</strong> verified lots
          </span>
          {statusFilter === "upcoming" && (
            <span className="text-blue-700 font-bold bg-blue-50 px-3 py-1 rounded-full border border-blue-200 inline-flex items-center gap-1.5">
              <Timer size={13} className="text-blue-600 animate-spin-slow" /> Showing Opening Soon / Scheduled Lots Only
            </span>
          )}
          {statusFilter === "closed" && (
            <span className="text-slate-700 font-bold bg-slate-200/80 px-3 py-1 rounded-full border border-slate-300 inline-flex items-center gap-1.5">
              <Lock size={13} className="text-slate-500" /> Showing Closed & Sold Auction Archive (Monochrome Mode)
            </span>
          )}
        </div>

        {statusFilter === "closed" && (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 p-4 shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-900 text-white">
                <Lock size={16} />
              </span>
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                  Archived / Completed Auctions
                </h4>
                <p className="text-[12px] text-slate-600 mt-0.5">
                  These lots have ended their bidding window. Closed lots are rendered in monochrome styling and secluded strictly within this archive.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Listings Grid / List */}
        <div className="mt-4">
          {loading ? (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  : "space-y-4"
              }
            >
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className={`animate-pulse rounded-2xl border border-slate-200 bg-white p-4 ${
                    viewMode === "grid" ? "h-96" : "h-48"
                  }`}
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center shadow-xs">
              <Package className="mx-auto text-slate-300 mb-3" size={54} />
              <h3 className="text-lg font-bold text-slate-900">No Marketplace Listings Found</h3>
              <p className="mt-1.5 text-sm text-slate-500 max-w-md mx-auto">
                We couldn't find any listings matching your search or active filter criteria. Try adjusting your filters or resetting them.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[#2563eb] px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs"
              >
                <RotateCcw size={14} /> Reset All Filters
              </button>
            </div>
          ) : (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  : "space-y-4"
              }
            >
              {items.map((item) => (
                <ListingCard key={item.id} item={item} viewMode={viewMode} />
              ))}
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>

            {[...Array(totalPages)].map((_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  className={`grid h-9 w-9 place-items-center rounded-xl text-xs font-bold shadow-2xs transition ${
                    currentPage === p
                      ? "bg-[#2563eb] text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {p}
                </button>
              );
            })}

            <button
              type="button"
              disabled={currentPage >= totalPages || loading}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}

        {/* Recently Viewed Lots Section */}
        {recentlyViewed.length > 0 && (
          <section className="mt-16 border-t border-slate-200 pt-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History size={16} className="text-[#2563eb]" />
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
                  Recently Viewed Lots
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRecentlyViewed([]);
                  try {
                    localStorage.removeItem("bidmylot_recently_viewed");
                  } catch {
                    // ignore
                  }
                }}
                className="text-[11px] font-semibold text-slate-400 hover:text-red-600 transition"
              >
                Clear history
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {recentlyViewed.map((lot) => (
                <a
                  key={lot.id}
                  href={`/auctions/${lot.slug || lot.id}`}
                  className="group block overflow-hidden rounded-xl border border-slate-200 bg-white p-2 transition hover:border-blue-300 hover:shadow-xs"
                >
                  <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-lg bg-slate-100 mb-2">
                    <img
                      src={resolveImageUrl(lot.imageUrl)}
                      alt={lot.title}
                      className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  </div>
                  <p className="text-[11px] font-bold text-slate-900 truncate group-hover:text-blue-600">
                    {lot.title}
                  </p>
                  <p className="text-[10px] font-extrabold text-[#2563eb] mt-0.5">
                    {formatCurrency(lot.askingPrice || 0)}
                  </p>
                </a>
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
