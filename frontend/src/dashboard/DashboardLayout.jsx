import React from "react";
import {
  Bell,
  ClipboardList,
  FileText,
  Gavel,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Shield,
  ShoppingBag,
  UserCheck,
  UserRound,
  Users,
} from "lucide-react";
import { Link } from "../components";
import { useAuth } from "../auth/AuthContext";
import { useNotificationCount } from "../hooks/useNotificationCount";

const roleIcons = { buyer: ShoppingBag, seller: Gavel, admin: UserRound };

const ADMIN_NAV_GROUPS = [
  {
    heading: "Core Operations",
    items: [
      { id: "overview", label: "Overview & Metrics", icon: Shield, isTab: true },
      { id: "auctions", label: "Listing Review Queue", icon: Gavel, isTab: true },
      { id: "categories", label: "Category Hierarchy", icon: Layers, isTab: true },
      { id: "verification", label: "Verification Queue", icon: UserCheck, isTab: true },
      { id: "users", label: "Account Management", icon: Users, isTab: true },
      { id: "orders", label: "Orders Oversight", icon: ClipboardList, href: "/admin/orders" },
      { id: "operations", label: "Disputes & Reviews", icon: UserCheck, href: "/admin/operations" },
      { id: "employees", label: "Employee Permissions", icon: UserRound, href: "/admin/employees" },
      { id: "support", label: "Support Tickets", icon: LifeBuoy, isTab: true },
    ],
  },
  {
    heading: "Page Management",
    items: [
      { id: "howItWorks", label: "How It Works Banner", icon: FileText, isTab: true },
      { id: "aboutPhotos", label: "About Page Photos", icon: ImageIcon, isTab: true },
    ],
  },
  {
    heading: "Platform",
    items: [
      { id: "notifications", label: "Notifications", icon: Bell, href: "/notifications", isNotifications: true },
      { id: "publicAuctions", label: "Public Auctions", icon: Gavel, href: "/auctions" },
    ],
  },
];

export function DashboardLayout({ role, title, description, children, sidebarExtra, activeTab, onSelectTab }) {
  const { user, logout } = useAuth();
  const RoleIcon = roleIcons[role] || LayoutDashboard;
  const { unreadCount } = useNotificationCount();

  const userType = user?.accountType || user?.role || role;
  const isFullAdmin = (role === "admin" || userType === "admin") && userType !== "admin_employee";
  const roleText = userType === "admin_employee"
    ? "Admin Employee"
    : userType === "admin"
    ? "Admin Account"
    : `${userType} account`;

  const handleLogout = async () => {
    await logout();
    window.location.href = `/${role === "admin" ? "admin" : role === "seller" ? "seller" : "buyer"}/login`;
  };

  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
  const isOnAdminDashboard = currentPath === "/admin/dashboard" || currentPath === "/admin";
  const isOnBuyerDashboard = currentPath === "/buyer/dashboard" || currentPath === "/buyer";
  const isOnSellerDashboard = currentPath === "/seller/dashboard" || currentPath === "/seller";
  const isOnDashboard = isFullAdmin
    ? isOnAdminDashboard
    : role === "seller"
    ? isOnSellerDashboard
    : isOnBuyerDashboard;

  const getNavLinkClass = (isActive) =>
    `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors text-left ${
      isActive
        ? "bg-[#2563eb] text-white font-bold shadow-xs"
        : "text-slate-600 hover:bg-slate-100 hover:text-[#0f172a]"
    }`;

  const isProfileActive = currentPath === `/${role}/profile`;
  const isOrdersActive = currentPath === `/${role}/orders` || currentPath === "/orders";
  const isNotificationsActive = currentPath === "/notifications";
  const isAuctionsActive = currentPath === "/auctions";
  const isDashboardActive = isOnDashboard && activeTab !== "support";
  const isSupportActive = isOnDashboard && activeTab === "support";

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <main className="mx-auto grid max-w-[1440px] items-start gap-8 px-4 sm:px-6 lg:px-8 py-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="w-full shrink-0 self-start rounded-xl border border-slate-200 bg-white p-4 shadow-2xs lg:sticky lg:top-6 lg:w-[240px]">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-50 text-[#2563eb]">
              <RoleIcon size={19} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{user?.fullName}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{roleText}</p>
            </div>
          </div>

          <nav className="mt-4 space-y-4" aria-label={`${role} dashboard navigation`}>
            {isFullAdmin ? (
              ADMIN_NAV_GROUPS.map((group) => (
                <div key={group.heading} className="space-y-1">
                  <p className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    {group.heading}
                  </p>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    if (item.isTab) {
                      const isActive = isOnAdminDashboard && activeTab === item.id;
                      if (isOnAdminDashboard && onSelectTab) {
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => onSelectTab(item.id)}
                            className={getNavLinkClass(isActive)}
                          >
                            <Icon size={14} />
                            <span className="truncate">{item.label}</span>
                          </button>
                        );
                      }
                      return (
                        <Link
                          key={item.id}
                          href={`/admin/dashboard?tab=${item.id}`}
                          className={getNavLinkClass(isActive)}
                        >
                          <Icon size={14} />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    }

                    const isActive = currentPath === item.href;
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        className={`justify-between ${getNavLinkClass(isActive)}`}
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          <Icon size={14} />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {item.isNotifications && unreadCount > 0 && (
                          <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white shadow-xs">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ))
            ) : (
              <div className="space-y-1.5">
                {isOnDashboard && onSelectTab ? (
                  <button
                    type="button"
                    onClick={() => onSelectTab(role === "seller" ? "auctions" : "main")}
                    className={getNavLinkClass(isDashboardActive)}
                  >
                    <LayoutDashboard size={15} /> Dashboard
                  </button>
                ) : (
                  <Link
                    href={`/${role}/dashboard`}
                    className={getNavLinkClass(isDashboardActive)}
                  >
                    <LayoutDashboard size={15} /> Dashboard
                  </Link>
                )}

                {role !== "admin" && (
                  <Link
                    href={`/${role}/profile`}
                    className={getNavLinkClass(isProfileActive)}
                  >
                    <UserCheck size={15} /> Profile & Verification
                  </Link>
                )}

                <Link href={`/${role}/orders`} className={getNavLinkClass(isOrdersActive)}>
                  <ClipboardList size={15} /> Orders
                </Link>

                <Link href="/notifications" className={`justify-between ${getNavLinkClass(isNotificationsActive)}`}>
                  <span className="flex items-center gap-2.5">
                    <Bell size={15} /> Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white shadow-xs">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>

                <Link
                  href="/auctions"
                  className={getNavLinkClass(isAuctionsActive)}
                >
                  <Gavel size={15} /> Public auctions
                </Link>

                {role !== "admin" && (
                  isOnDashboard && onSelectTab ? (
                    <button
                      type="button"
                      onClick={() => onSelectTab("support")}
                      className={getNavLinkClass(isSupportActive)}
                    >
                      <LifeBuoy size={15} className={isSupportActive ? "text-white" : "text-[#2563eb]"} /> Support & Complaints
                    </button>
                  ) : (
                    <Link
                      href={`/${role}/dashboard?tab=support`}
                      className={getNavLinkClass(isSupportActive)}
                    >
                      <LifeBuoy size={15} className={isSupportActive ? "text-white" : "text-[#2563eb]"} /> Support & Complaints
                    </Link>
                  )
                )}

                {sidebarExtra}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors text-left"
              >
                <LogOut size={15} /> Log Out
              </button>
            </div>
          </nav>
        </aside>

        <section className="min-w-0 min-h-[500px]">
          <header className="mb-8">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#2563eb]">
              {role} dashboard foundation
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
          </header>
          {children}
        </section>
      </main>
    </div>
  );
}

export function DashboardSection({ title, description, children }) {
  return (
    <section className="mb-7 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}
