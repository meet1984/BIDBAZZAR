import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Filter,
  Gavel,
  Layers,
  LifeBuoy,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  XCircle,
} from "lucide-react";
import { CreateUserModal } from "../components/CreateUserModal";
import { useAuth } from "../auth/AuthContext";
import api from "../lib/api";
import { errorMessage, formatDateTime, formatINR } from "../lib/format";
import { resolveImageUrl } from "../lib/image";
import { EmptyState, LoadingState } from "../components";
import { VerificationQueueSection } from "../admin/VerificationQueueSection";
import { CategoryManagementSection } from "../admin/CategoryManagementSection";
import { ListingReviewModal } from "../admin/ListingReviewModal";
import { DashboardLayout } from "./DashboardLayout";
import AuctionForm from "./AuctionForm";
import { compressImage } from "../lib/imageCompression";

export default function AdminDashboardPage() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState("auctions"); // 'auctions' | 'overview' | 'users' | 'support'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState("");

  // Overview Data
  const [dashboardData, setDashboardData] = useState(null);

  // Auctions Management State
  const [auctions, setAuctions] = useState([]);
  const [auctionFilterStatus, setAuctionFilterStatus] = useState("all");
  const [auctionSearch, setAuctionSearch] = useState("");
  const [auctionsLoading, setAuctionsLoading] = useState(false);
  const [editingAuction, setEditingAuction] = useState(null);
  const [isCreatingAuction, setIsCreatingAuction] = useState(false);
  const [reviewModalAuction, setReviewModalAuction] = useState(null);

  // Users Management State
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);

  // Support Enquiries State
  const [enquiries, setEnquiries] = useState([]);
  const [supportLoading, setSupportLoading] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [supportStatusFilter, setSupportStatusFilter] = useState("all");
  const [supportRoleFilter, setSupportRoleFilter] = useState("all");
  const [supportSearch, setSupportSearch] = useState("");

  // Banner Management State
  const [bannerUrl, setBannerUrl] = useState(() => {
    return localStorage.getItem("how_it_works_banner") || "/hero-auction-marketplace.png";
  });
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerMsg, setBannerMsg] = useState({ type: "", text: "" });

  // Load Overview Data
  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/dashboard/admin");
      setDashboardData(data);
    } catch (err) {
      setError(errorMessage(err, "Failed to load admin overview metrics."));
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Listings / Auctions
  const loadAuctions = useCallback(async () => {
    setAuctionsLoading(true);
    try {
      const statusParam = auctionFilterStatus !== "all" ? auctionFilterStatus : undefined;
      const { data } = await api.get("/admin/listings", {
        params: { reviewStatus: statusParam },
      });
      const items = (data.items || []).map((l) => ({
        ...l,
        lotNumber: l.listingReference || `LOT-${l.id}`,
        category: l.categoryName || l.category?.name || "General",
        seller: { name: l.sellerName || l.seller?.name || "Seller" },
        startingPrice: l.askingPrice || l.askingPricePerUnit || 0,
        status: l.reviewStatus || l.status,
        workflowStatus: l.reviewStatus || l.workflowStatus || l.status,
      }));
      setAuctions(items);
    } catch (err) {
      setError(errorMessage(err, "Failed to load listings list."));
    } finally {
      setAuctionsLoading(false);
    }
  }, [auctionFilterStatus]);

  // Load Users
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const { data } = await api.get("/admin/users", {
        params: {
          q: userSearch || undefined,
          role: userRoleFilter || undefined,
          status: userStatusFilter || undefined,
          pageSize: 50,
        },
      });
      setUsers(data.items || []);
    } catch (err) {
      setError(errorMessage(err, "Failed to load user management records."));
    } finally {
      setUsersLoading(false);
    }
  }, [userSearch, userRoleFilter, userStatusFilter]);

  // Load Support Enquiries
  const loadSupport = useCallback(async () => {
    setSupportLoading(true);
    try {
      const { data } = await api.get("/admin/support/enquiries");
      const items = data.items || data || [];
      setEnquiries(items);
      if (items.length > 0 && !selectedEnquiry) {
        setSelectedEnquiry(items[0]);
      }
    } catch (err) {
      setError(errorMessage(err, "Failed to load support enquiries."));
    } finally {
      setSupportLoading(false);
    }
  }, [selectedEnquiry]);

  const handleUpdateSupportStatus = async (id, status) => {
    setActionId(`support-${id}`);
    try {
      await api.patch(`/admin/support/enquiries/${id}/status`, { status });
      setEnquiries((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status } : item))
      );
      if (selectedEnquiry?.id === id) {
        setSelectedEnquiry((prev) => (prev ? { ...prev, status } : null));
      }
    } catch (err) {
      setError(errorMessage(err, "Failed to update ticket status."));
    } finally {
      setActionId("");
    }
  };

  const handleDownloadAttachment = async (id) => {
    try {
      const response = await api.get(`/admin/support/enquiries/${id}/attachment`, { responseType: "blob" });
      const objectUrl = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `support-attachment-${id}`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(errorMessage(err, "Attachment download failed."));
    }
  };

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (activeTab === "auctions") loadAuctions();
    if (activeTab === "users") loadUsers();
    if (activeTab === "support") loadSupport();
    if (activeTab === "howItWorks") {
      api
        .get("/settings/how-it-works-banner")
        .then(({ data }) => {
          if (data?.bannerUrl) {
            setBannerUrl(data.bannerUrl);
            localStorage.setItem("how_it_works_banner", data.bannerUrl);
          }
        })
        .catch(() => { });
    }
  }, [activeTab, loadAuctions, loadUsers, loadSupport]);

  const handleToggleUserStatus = async (user) => {
    setActionId(`user-${user.id}`);
    const nextStatus = user.status === "active" ? "suspended" : "active";
    try {
      await api.patch(`/admin/users/${user.id}/status`, { status: nextStatus });
      await loadUsers();
      await loadOverview();
    } catch (err) {
      setError(errorMessage(err, "User status update failed."));
    } finally {
      setActionId("");
    }
  };

  const handleChangeUserRole = async (targetUser, newRole) => {
    if (targetUser.id === currentUser?.id) {
      setError("You cannot change your own admin role.");
      return;
    }
    setActionId(`role-${targetUser.id}`);
    try {
      await api.patch(`/admin/users/${targetUser.id}/role`, { role: newRole });
      await loadUsers();
      await loadOverview();
    } catch (err) {
      setError(errorMessage(err, "User role update failed."));
    } finally {
      setActionId("");
    }
  };

  const handleDeleteAuction = async (id) => {
    if (!window.confirm("Are you sure you want to soft-delete this auction?")) return;
    setActionId(`delete-${id}`);
    try {
      await api.delete(`/admin/listings/${id}`);
      await loadAuctions();
      await loadOverview();
    } catch (err) {
      setError(errorMessage(err, "Failed to delete auction."));
    } finally {
      setActionId("");
    }
  };

  const handleBannerFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setBannerMsg({ type: "error", text: "Please select a valid image file (JPG, PNG, WebP)." });
      return;
    }
    setBannerUploading(true);
    setBannerMsg({ type: "", text: "" });
    try {
      setBannerFile(file);
      const compressed = await compressImage(file, 1600, 0.85);
      setBannerUrl(compressed);
      setBannerMsg({ type: "success", text: "Photo selected & preview ready. Click 'Save Banner Changes' to publish." });
    } catch {
      setBannerMsg({ type: "error", text: "Failed to process image file." });
    } finally {
      setBannerUploading(false);
    }
  };

  const handleSaveBanner = async () => {
    setBannerSaving(true);
    setBannerMsg({ type: "", text: "" });
    try {
      let savedUrl = bannerUrl;
      if (bannerFile) {
        const formData = new FormData();
        formData.append("image", bannerFile);
        const { data } = await api.post("/admin/settings/how-it-works-banner/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        savedUrl = data.bannerUrl;
        setBannerUrl(savedUrl);
        setBannerFile(null);
      } else {
        const { data } = await api.put("/admin/settings/how-it-works-banner", { bannerUrl });
        if (data?.bannerUrl) {
          savedUrl = data.bannerUrl;
          setBannerUrl(savedUrl);
        }
      }
      localStorage.setItem("how_it_works_banner", savedUrl);
      setBannerMsg({ type: "success", text: "How It Works page banner photo updated successfully!" });
    } catch (err) {
      setBannerMsg({ type: "error", text: errorMessage(err, "Failed to save banner image.") });
    } finally {
      setBannerSaving(false);
    }
  };

  const handleResetBanner = async () => {
    const defaultUrl = "/hero-auction-marketplace.png";
    setBannerUrl(defaultUrl);
    setBannerFile(null);
    try {
      await api.put("/admin/settings/how-it-works-banner", { bannerUrl: defaultUrl });
      localStorage.setItem("how_it_works_banner", defaultUrl);
      setBannerMsg({ type: "success", text: "Banner reset to default image." });
    } catch (err) {
      setBannerMsg({ type: "error", text: errorMessage(err, "Failed to reset banner.") });
    }
  };

  const filteredAuctions = auctions.filter((item) => {
    if (!auctionSearch.trim()) return true;
    const q = auctionSearch.toLowerCase();
    const title = (item.title || "").toLowerCase();
    const category = (typeof item.category === "string" ? item.category : item.category?.name || "").toLowerCase();
    const lotNumber = (item.lotNumber || item.listingReference || "").toLowerCase();
    const sellerName = (item.seller?.name || item.sellerName || "").toLowerCase();
    return (
      title.includes(q) ||
      category.includes(q) ||
      lotNumber.includes(q) ||
      sellerName.includes(q)
    );
  });

  const sidebarExtraNav = (
    <div className="mt-4 border-t border-slate-200 pt-4 space-y-1">
      <p className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
        Admin Sections
      </p>
      {[
        { id: "auctions", label: "Listing Review Queue", icon: Gavel },
        { id: "categories", label: "Category Hierarchy", icon: Layers },
        { id: "verification", label: "Verification Queue", icon: UserCheck },
        { id: "overview", label: "Overview & Moderation", icon: Shield },
        { id: "users", label: "Account Management", icon: Users },
        { id: "support", label: "Support Tickets", icon: LifeBuoy },
        { id: "howItWorks", label: "How It Works Banner", icon: FileText },
      ].map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-2 rounded px-3 py-2 text-xs font-semibold transition-colors ${isActive
                ? "bg-[#2563eb] text-white font-bold"
                : "text-slate-600 hover:bg-slate-100 hover:text-[#0f172a]"
              }`}
          >
            <Icon size={14} />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <DashboardLayout
      role="admin"
      title="Platform Administration Command Center"
      description="Full operational authority over marketplace auctions, user accounts, security controls, support inquiries, and page content."
      sidebarExtra={sidebarExtraNav}
    >
      <CreateUserModal
        isOpen={createUserModalOpen}
        onClose={() => setCreateUserModalOpen(false)}
        onUserCreated={() => {
          loadUsers();
          loadOverview();
        }}
      />
      {/* Header Metric Quick Stats */}
      {dashboardData && (
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Pending Reviews</span>
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <p className="mt-2 text-3xl font-black text-[#0f172a]">
              {dashboardData.pendingAuctions?.length || 0}
            </p>
            <p className="mt-1 text-xs text-amber-600 font-medium">Awaiting administrator approval</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Active Accounts</span>
              <Users className="h-5 w-5 text-[#2563eb]" />
            </div>
            <p className="mt-2 text-3xl font-black text-[#0f172a]">
              {dashboardData.users?.length || 0}
            </p>
            <p className="mt-1 text-xs text-blue-600 font-medium">Registered account holders</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Support Inbox</span>
              <LifeBuoy className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="mt-2 text-3xl font-black text-[#0f172a]">
              {dashboardData.enquiries?.length || 0}
            </p>
            <p className="mt-1 text-xs text-emerald-600 font-medium">Customer support tickets</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">System Status</span>
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="mt-2 text-xl font-black text-emerald-700">Healthy</p>
            <p className="mt-1 text-xs text-slate-500 font-medium">Database health is reported by the backend</p>
          </div>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <nav className="flex space-x-6 overflow-x-auto pb-1" aria-label="Admin Tabs">
          {[
            { id: "auctions", label: "Listing Review Queue", icon: Gavel },
            { id: "categories", label: "Category Hierarchy", icon: Layers },
            { id: "verification", label: "Verification Queue", icon: UserCheck },
            { id: "overview", label: "Overview & Moderation", icon: Shield },
            { id: "users", label: "Account Management", icon: Users },
            { id: "support", label: "Support Tickets", icon: LifeBuoy },
            { id: "howItWorks", label: "How It Works Banner", icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 py-3 text-xs font-extrabold transition-all ${isActive
                    ? "border-[#2563eb] text-[#2563eb]"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={loadOverview}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin text-[#2563eb]" : ""} />
          Refresh Data
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError("")} className="text-red-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 0: CATEGORY MANAGEMENT */}
      {activeTab === "categories" && <CategoryManagementSection />}

      {/* TAB 0.5: VERIFICATION MODERATION QUEUE */}
      {activeTab === "verification" && <VerificationQueueSection />}

      {/* TAB 1: OVERVIEW & MODERATION QUEUE */}
      {activeTab === "overview" && (
        <div className="space-y-8">
          {loading ? <LoadingState label="Fetching administrative dashboard data…" /> : null}

          {dashboardData && (
            <>
              {/* Pending Review Queue */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                  <div>
                    <h3 className="text-lg font-black text-[#0f172a]">Pending Auction Submissions</h3>
                    <p className="text-xs text-slate-500">Review seller submissions before they are published to the public marketplace.</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-800">
                    {dashboardData.pendingAuctions.length} Pending
                  </span>
                </div>

                {dashboardData.pendingAuctions.length ? (
                  <div className="divide-y divide-slate-100">
                    {dashboardData.pendingAuctions.map((auction) => (
                      <div key={auction.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-[#0f172a] text-sm">{auction.title}</span>
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                              {typeof auction.category === "string" ? auction.category : auction.category?.name || auction.categoryName || "General"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            Seller: <b className="text-slate-700">{auction.seller?.name || "Individual Seller"}</b> · Starting Price: <b className="text-[#2563eb]">{formatINR(auction.startingPrice)}</b> · Lot #{auction.lotNumber}
                          </p>
                          <p className="text-xs text-slate-400">Scheduled Start: {formatDateTime(auction.startsAt)}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={`/auctions/${auction.slug || auction.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-[#2563eb] hover:text-[#2563eb] transition-colors"
                            title="Preview Listing"
                          >
                            <ExternalLink size={14} /> Preview
                          </a>
                          <button
                            type="button"
                            onClick={() => setEditingAuction(auction)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-800 hover:bg-purple-100 transition-colors"
                            title="Edit details & send changes to seller for confirmation"
                          >
                            <Edit3 size={14} /> Make Changes
                          </button>
                          <button
                            type="button"
                            onClick={() => setReviewModalAuction(auction)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                          >
                            <CheckCircle2 size={14} /> Approve Directly
                          </button>
                          <button
                            type="button"
                            onClick={() => setReviewModalAuction(auction)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors"
                          >
                            <XCircle size={14} /> Review / Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No pending reviews" description="All submitted auctions have been reviewed." />
                )}
              </div>

              {/* Quick Actions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Recent Users Summary */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                    <h4 className="font-extrabold text-[#0f172a] text-sm">Recent Registered Users</h4>
                    <button type="button" onClick={() => setActiveTab("users")} className="text-xs font-bold text-[#2563eb] hover:underline">
                      Manage All Users →
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {dashboardData.users.slice(0, 5).map((user) => (
                      <div key={user.id} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="text-xs font-bold text-[#0f172a]">{user.fullName}</p>
                          <p className="text-[11px] text-slate-500">
                            {user.email} · {user.accountType || (user.isAdmin || user.role === "admin" ? "Admin" : user.isSeller ? "Seller" : "Buyer")}
                          </p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${user.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                          }`}>
                          {user.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Support Enquiries Summary */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                    <h4 className="font-extrabold text-[#0f172a] text-sm">Support Tickets Overview</h4>
                    <button type="button" onClick={() => setActiveTab("support")} className="text-xs font-bold text-[#2563eb] hover:underline">
                      View Inbox →
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {dashboardData.enquiries.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="text-xs font-bold text-[#0f172a] truncate max-w-[200px]">{item.subject}</p>
                          <p className="text-[11px] text-slate-500">{item.reference} · {item.fullName}</p>
                        </div>
                        <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-[#2563eb]">
                          {item.contactRole || "User"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: FULL AUCTION MANAGEMENT */}
      {activeTab === "auctions" && (
        <div className="space-y-6">
          {/* Controls & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search auctions by title, lot number, category, seller..."
                value={auctionSearch}
                onChange={(e) => setAuctionSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-medium text-[#0f172a] outline-none transition focus:border-[#2563eb] focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <Filter size={14} /> Filter Status:
              </span>
              <select
                value={auctionFilterStatus}
                onChange={(e) => setAuctionFilterStatus(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-[#2563eb]"
              >
                <option value="all">All Workflow Statuses</option>
                <option value="sold">Sold Lots (Monochrome)</option>
                <option value="approved">Approved / Live / Published</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed / Completed</option>
                <option value="rejected">Rejected</option>
              </select>

              <button
                type="button"
                onClick={() => setIsCreatingAuction(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1d4ed8] transition-colors"
              >
                <Plus size={15} /> Create Auction
              </button>
            </div>
          </div>

          {auctionsLoading ? <LoadingState label="Loading catalog auctions…" /> : null}

          {!auctionsLoading && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 font-extrabold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3.5 px-4">Lot & Title</th>
                      <th className="py-3.5 px-4">Category</th>
                      <th className="py-3.5 px-4">Starting / Current</th>
                      <th className="py-3.5 px-4">Schedule</th>
                      <th className="py-3.5 px-4">Workflow</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAuctions.map((auction) => {
                      const isSold =
                        auction.workflowStatus === "sold" ||
                        auction.status === "sold" ||
                        auction.reviewStatus === "sold" ||
                        auction.workflowStatus === "completed" ||
                        auction.status === "completed";

                      return (
                        <tr
                          key={auction.id}
                          className={`transition-all ${
                            isSold
                              ? "bg-slate-100/90 grayscale border-l-4 border-l-slate-800 text-slate-600 hover:bg-slate-200/80"
                              : "hover:bg-slate-50/80"
                          }`}
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <p className={`font-extrabold ${isSold ? "text-slate-700 line-through decoration-slate-400" : "text-[#0f172a]"}`}>
                                {auction.title}
                              </p>
                              {isSold && (
                                <span className="inline-flex items-center rounded-sm bg-black px-1.5 py-0.5 text-[9px] font-black uppercase text-white tracking-widest shrink-0 shadow-2xs">
                                  SOLD
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono">
                              Lot #{auction.lotNumber} {auction.seller?.name ? `· Seller: ${auction.seller.name}` : ""}
                            </p>
                          </td>
                          <td className="py-4 px-4 text-slate-600 font-medium">
                            {typeof auction.category === "string" ? auction.category : auction.category?.name || auction.categoryName || "General"}
                          </td>
                          <td className="py-4 px-4 font-bold">
                            <span className={isSold ? "text-slate-800 font-mono" : "text-[#2563eb]"}>
                              {formatINR(auction.currentBid ?? auction.startingPrice)}
                            </span>
                            {isSold && (
                              <span className="block text-[10px] text-slate-500 font-normal uppercase">
                                (Sold Value)
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-slate-500">
                            <p className="text-[11px]">Start: {formatDateTime(auction.startsAt || auction.startTime)}</p>
                            <p className="text-[11px]">End: {formatDateTime(auction.endsAt || auction.endTime)}</p>
                          </td>
                          <td className="py-4 px-4">
                            {isSold ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-black bg-black px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-2xs">
                                ● SOLD LOT
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${
                                  auction.workflowStatus === "approved"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : auction.workflowStatus === "pending"
                                      ? "bg-amber-100 text-amber-800"
                                      : auction.workflowStatus === "changes_requested"
                                        ? "bg-purple-100 text-purple-800"
                                        : auction.workflowStatus === "rejected"
                                          ? "bg-red-100 text-red-800"
                                          : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {auction.workflowStatus === "changes_requested" ? "Awaiting Seller Confirmation" : auction.workflowStatus}
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <a
                                href={`/auctions/${auction.slug || auction.publicSlug || auction.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded border border-slate-200 p-1.5 text-slate-600 hover:border-[#2563eb] hover:text-[#2563eb]"
                                title="View Public Auction Page"
                              >
                                <ExternalLink size={14} />
                              </a>
                              {!isSold && auction.workflowStatus !== "closed" && (
                                <button
                                  type="button"
                                  onClick={() => setReviewModalAuction(auction)}
                                  className={`rounded px-2.5 py-1 text-[11px] font-bold text-white transition-colors ${
                                    auction.workflowStatus === "approved"
                                      ? "bg-amber-600 hover:bg-amber-700"
                                      : "bg-emerald-600 hover:bg-emerald-700"
                                  }`}
                                  title="Review / Approve / Reject Auction"
                                >
                                  {auction.workflowStatus === "approved" ? "Moderate" : "Review"}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setEditingAuction(auction)}
                                className="rounded border border-slate-200 p-1.5 text-slate-600 hover:border-[#2563eb] hover:text-[#2563eb]"
                                title="Edit Auction Details"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                type="button"
                                disabled={actionId === `delete-${auction.id}`}
                                onClick={() => handleDeleteAuction(auction.id)}
                                className="rounded border border-red-200 p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                                title="Delete Auction"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {!filteredAuctions.length && (
                <div className="p-8 text-center text-xs text-slate-500">
                  No auctions found matching current search and filter parameters.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: USER MANAGEMENT */}
      {activeTab === "users" && (
        <div className="space-y-6">
          {/* User Search & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search users by name or email address..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-medium text-[#0f172a] outline-none transition focus:border-[#2563eb] focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-[#2563eb]"
              >
                <option value="">All Roles</option>
                <option value="buyer">Buyers</option>
                <option value="seller">Sellers</option>
                <option value="admin">Admins</option>
              </select>
              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-[#2563eb]"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
              <button
                type="button"
                onClick={() => setCreateUserModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#1d4ed8]"
              >
                <UserPlus size={14} /> Add User
              </button>
            </div>
          </div>

          {usersLoading ? <LoadingState label="Loading registered platform users…" /> : null}

          {!usersLoading && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 font-extrabold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3.5 px-4">User Details</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Registered Date</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Moderation Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-4">
                          <p className="font-extrabold text-[#0f172a]">{u.fullName}</p>
                          <p className="text-slate-500">{u.email}</p>
                        </td>
                        <td className="py-4 px-4">
                          {u.id === currentUser?.id ? (
                            <span className="rounded bg-purple-100 px-2.5 py-1 text-[10px] font-extrabold uppercase text-purple-800">
                              Admin (You)
                            </span>
                          ) : (
                            <select
                              value={u.accountType || u.role || "buyer"}
                              disabled={actionId === `role-${u.id}`}
                              onChange={(e) => handleChangeUserRole(u, e.target.value)}
                              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-800 shadow-xs outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 disabled:opacity-50"
                            >
                              <option value="buyer">Buyer Only</option>
                              <option value="seller">Seller Only</option>
                              <option value="admin">Admin</option>
                            </select>
                          )}
                        </td>
                        <td className="py-4 px-4 text-slate-500">{formatDateTime(u.createdAt)}</td>
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${u.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                              }`}
                          >
                            {u.status === "active" ? <UserCheck size={12} /> : <UserX size={12} />}
                            {u.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          {u.role !== "admin" ? (
                            <button
                              type="button"
                              disabled={actionId === `user-${u.id}`}
                              onClick={() => handleToggleUserStatus(u)}
                              className={`rounded px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${u.status === "active"
                                  ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                  : "bg-emerald-600 text-white hover:bg-emerald-700"
                                }`}
                            >
                              {u.status === "active" ? "Suspend Account" : "Reactivate Account"}
                            </button>
                          ) : (
                            <span className="text-[11px] font-bold text-slate-400 italic">Protected Admin</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SUPPORT TICKETS & COMPLAINTS MANAGEMENT */}
      {activeTab === "support" && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Support & Complaints</span>
              <p className="mt-1 text-2xl font-black text-[#0f172a]">{enquiries.length}</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#2563eb]">Open Tickets</span>
              <p className="mt-1 text-2xl font-black text-[#2563eb]">
                {enquiries.filter((e) => e.status === "open").length}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">In Progress</span>
              <p className="mt-1 text-2xl font-black text-amber-800">
                {enquiries.filter((e) => e.status === "in_progress").length}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">Resolved / Closed</span>
              <p className="mt-1 text-2xl font-black text-emerald-800">
                {enquiries.filter((e) => e.status === "resolved" || e.status === "closed").length}
              </p>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search ticket ref, subject, email or name..."
                value={supportSearch}
                onChange={(e) => setSupportSearch(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none focus:border-[#2563eb] focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs">
                {["all", "open", "in_progress", "resolved", "closed"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSupportStatusFilter(st)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-bold capitalize transition-colors ${supportStatusFilter === st
                        ? "bg-[#0f172a] text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-200/60"
                      }`}
                  >
                    {st.replace("_", " ")}
                  </button>
                ))}
              </div>

              <select
                value={supportRoleFilter}
                onChange={(e) => setSupportRoleFilter(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none"
              >
                <option value="all">All Roles</option>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="visitor">Visitor</option>
              </select>
            </div>
          </div>

          {supportLoading ? <LoadingState label="Loading support tickets…" /> : null}

          {!supportLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Tickets List */}
              <div className="lg:col-span-5 space-y-3 max-h-[650px] overflow-y-auto pr-1">
                {(() => {
                  const filtered = enquiries.filter((t) => {
                    const matchesStatus = supportStatusFilter === "all" || t.status === supportStatusFilter;
                    const matchesRole = supportRoleFilter === "all" || t.role === supportRoleFilter;
                    const q = supportSearch.toLowerCase().trim();
                    const matchesSearch =
                      !q ||
                      t.reference.toLowerCase().includes(q) ||
                      t.subject.toLowerCase().includes(q) ||
                      t.email.toLowerCase().includes(q) ||
                      t.fullName.toLowerCase().includes(q) ||
                      (t.auctionReference && t.auctionReference.toLowerCase().includes(q));
                    return matchesStatus && matchesRole && matchesSearch;
                  });

                  if (!filtered.length) {
                    return (
                      <EmptyState
                        title="No matching tickets"
                        description="No support enquiries match the selected filter parameters."
                      />
                    );
                  }

                  return filtered.map((ticket) => {
                    const isSelected = selectedEnquiry?.id === ticket.id;
                    const statusBadgeClass =
                      ticket.status === "resolved"
                        ? "bg-emerald-100 text-emerald-800"
                        : ticket.status === "in_progress"
                          ? "bg-amber-100 text-amber-800"
                          : ticket.status === "closed"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-blue-100 text-[#2563eb]";

                    return (
                      <div
                        key={ticket.id}
                        onClick={() => setSelectedEnquiry(ticket)}
                        className={`cursor-pointer rounded-xl border p-4 shadow-xs transition-all ${isSelected
                            ? "border-[#2563eb] bg-blue-50/50 ring-2 ring-blue-500/20"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-[#2563eb]">{ticket.reference}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-slate-600">
                              {ticket.role}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${statusBadgeClass}`}>
                              {ticket.status.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                        <h4 className="mt-2 font-extrabold text-[#0f172a] text-sm leading-snug">{ticket.subject}</h4>
                        <p className="mt-1 text-xs text-slate-500">{ticket.fullName} ({ticket.email})</p>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                          <span className="capitalize font-medium text-slate-600">Reason: {ticket.reason}</span>
                          <span>{formatDateTime(ticket.createdAt)}</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Right Column: Ticket Preview Panel */}
              <div className="lg:col-span-7">
                {selectedEnquiry ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#2563eb]">{selectedEnquiry.reference}</span>
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-slate-600">
                            {selectedEnquiry.role}
                          </span>
                        </div>
                        <h3 className="text-xl font-black text-[#0f172a] mt-1">{selectedEnquiry.subject}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Submitted by <b className="text-slate-800">{selectedEnquiry.fullName}</b> ({selectedEnquiry.email}) on {formatDateTime(selectedEnquiry.createdAt)}
                        </p>
                      </div>

                      {/* Status Action Buttons */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-[10px] font-extrabold uppercase text-slate-400">Update Status</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {selectedEnquiry.status !== "in_progress" && (
                            <button
                              type="button"
                              disabled={actionId === `support-${selectedEnquiry.id}`}
                              onClick={() => handleUpdateSupportStatus(selectedEnquiry.id, "in_progress")}
                              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors disabled:opacity-50"
                            >
                              In Progress
                            </button>
                          )}
                          {selectedEnquiry.status !== "resolved" && (
                            <button
                              type="button"
                              disabled={actionId === `support-${selectedEnquiry.id}`}
                              onClick={() => handleUpdateSupportStatus(selectedEnquiry.id, "resolved")}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50"
                            >
                              ✓ Resolve
                            </button>
                          )}
                          {selectedEnquiry.status !== "closed" && (
                            <button
                              type="button"
                              disabled={actionId === `support-${selectedEnquiry.id}`}
                              onClick={() => handleUpdateSupportStatus(selectedEnquiry.id, "closed")}
                              className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
                            >
                              Close Ticket
                            </button>
                          )}
                          {selectedEnquiry.status !== "open" && (
                            <button
                              type="button"
                              disabled={actionId === `support-${selectedEnquiry.id}`}
                              onClick={() => handleUpdateSupportStatus(selectedEnquiry.id, "open")}
                              className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-[#2563eb] hover:bg-blue-100 transition-colors disabled:opacity-50"
                            >
                              Re-open
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid gap-4 sm:grid-cols-2 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs">
                      <div>
                        <span className="font-bold text-slate-400 uppercase text-[10px] block">Complaint Category / Reason</span>
                        <p className="font-extrabold text-[#0f172a] mt-0.5 capitalize">{selectedEnquiry.reason.replace("-", " ")}</p>
                      </div>
                      <div>
                        <span className="font-bold text-slate-400 uppercase text-[10px] block">Current Status</span>
                        <p className="font-extrabold text-[#2563eb] mt-0.5 capitalize">{selectedEnquiry.status.replace("_", " ")}</p>
                      </div>
                      {selectedEnquiry.auctionReference && (
                        <div className="sm:col-span-2">
                          <span className="font-bold text-slate-400 uppercase text-[10px] block">Related Auction / Listing Reference</span>
                          <p className="font-mono font-bold text-[#2563eb] mt-0.5">{selectedEnquiry.auctionReference}</p>
                        </div>
                      )}
                    </div>

                    {/* Attachment Card */}
                    {selectedEnquiry.attachment && (
                      <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-100 text-[#2563eb]">
                            <FileText size={20} />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-[#0f172a] block">{selectedEnquiry.attachment.name}</span>
                            <span className="text-[10px] text-slate-500 uppercase">{selectedEnquiry.attachment.mime}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownloadAttachment(selectedEnquiry.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f172a] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#2563eb] transition-colors"
                        >
                          <Download size={14} /> Download Attachment
                        </button>
                      </div>
                    )}

                    {/* Complaint Message Body */}
                    <div className="border-t border-slate-100 pt-3">
                      <h5 className="text-xs font-bold uppercase text-slate-400 mb-2">Complaint / Message Detail</h5>
                      <div className="rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap border border-slate-200/70 min-h-[120px]">
                        {selectedEnquiry.message || "No message content."}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500">
                    Select a support ticket from the list to view its contents, attachments, and update status.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: HOW IT WORKS BANNER MANAGEMENT */}
      {activeTab === "howItWorks" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-[11px] font-bold text-[#2563eb]">
                  <FileText size={14} /> Page Banner Control
                </span>
                <h2 className="mt-2 text-xl font-extrabold text-[#0f172a]">
                  How It Works Hero Banner
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Upload, change, or reset the hero image shown at the top of the public How It Works page.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetBanner}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs"
                >
                  Reset Default
                </button>
                <button
                  type="button"
                  onClick={handleSaveBanner}
                  disabled={bannerSaving || bannerUploading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-5 py-2 text-xs font-bold text-white hover:bg-[#1d4ed8] shadow-xs disabled:opacity-50"
                >
                  {bannerSaving ? "Saving..." : "Save Banner Changes"}
                </button>
              </div>
            </div>

            {bannerMsg.text && (
              <div
                className={`mt-4 rounded-lg p-4 text-xs font-bold flex items-center gap-2 ${bannerMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                    : "bg-red-50 text-red-900 border border-red-200"
                  }`}
              >
                {bannerMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{bannerMsg.text}</span>
              </div>
            )}

            {/* Banner Preview Card */}
            <div className="mt-6">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3">
                Live Banner Preview
              </label>
              <div className="relative aspect-[16/9] max-h-[360px] w-full overflow-hidden rounded-xl border border-slate-200 bg-[#0f172a] shadow-inner group">
                <img
                  src={resolveImageUrl(bannerUrl)}
                  alt="How It Works Banner Preview"
                  className="h-full w-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/70 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-white/20 bg-white/90 p-3 backdrop-blur shadow-lg">
                  <p className="text-xs font-bold text-[#0f172a]">Public Banner Preview</p>
                  <p className="text-[10px] text-slate-500 truncate">{bannerUrl.slice(0, 80)}...</p>
                </div>
              </div>
            </div>

            {/* Upload Controls */}
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:border-[#2563eb] transition-colors">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-100 text-[#2563eb]">
                  <Upload size={22} />
                </div>
                <h3 className="mt-3 text-sm font-bold text-[#0f172a]">Upload New Photo</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Select a banner photo from your computer (auto-compressed for fast loading).
                </p>
                <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-lg bg-[#0f172a] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#2563eb] transition-colors">
                  {bannerUploading ? "Compressing Photo..." : "Choose Image File"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBannerFileSelect}
                    disabled={bannerUploading}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#0f172a]">Image URL Link</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Alternatively, paste an external image URL directly.
                  </p>
                  <input
                    type="url"
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    placeholder="https://example.com/banner.jpg"
                    className="mt-4 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-[#2563eb]"
                  />
                </div>
                <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-200 pt-3">
                  <span>Recommended ratio: 16:9</span>
                  <span>Max size: 10MB</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Review & Moderation Modal */}
      {reviewModalAuction && (
        <ListingReviewModal
          listing={reviewModalAuction}
          onClose={() => setReviewModalAuction(null)}
          onSuccess={() => {
            loadAuctions();
            loadOverview();
          }}
        />
      )}

      {/* Edit Auction Modal */}
      {editingAuction && (
        <AuctionForm
          auction={editingAuction}
          isAdmin={true}
          onClose={() => setEditingAuction(null)}
          onSuccess={() => {
            setEditingAuction(null);
            if (activeTab === "auctions") loadAuctions();
            loadOverview();
          }}
        />
      )}

      {/* Create Auction Modal */}
      {isCreatingAuction && (
        <AuctionForm
          isAdmin={true}
          onClose={() => setIsCreatingAuction(false)}
          onSuccess={() => {
            setIsCreatingAuction(false);
            if (activeTab === "auctions") loadAuctions();
            loadOverview();
          }}
        />
      )}
    </DashboardLayout>
  );
}
