import React, { useEffect, useState } from "react";
import { Bell, ClipboardList, Gavel, LayoutDashboard, LifeBuoy, LogOut, ShoppingBag, UserCheck, UserRound } from "lucide-react";
import { Link } from "../components";
import { useAuth } from "../auth/AuthContext";
import api from "../lib/api";

const roleIcons = { buyer: ShoppingBag, seller: Gavel, admin: UserRound };

export function DashboardLayout({ role, title, description, children, sidebarExtra, activeTab, onSelectTab }) {
  const { user, logout } = useAuth();
  const RoleIcon = roleIcons[role] || LayoutDashboard;
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    if (!user) return;

    const fetchUnread = async () => {
      try {
        const { data } = await api.get("/notifications?limit=1");
        if (mounted && typeof data?.unreadCount === "number") {
          setUnreadCount(data.unreadCount);
        }
      } catch {
        // Silently ignore notification count polling failures
      }
    };

    void fetchUnread();
    const interval = setInterval(fetchUnread, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [user]);

  const userType = user?.accountType || user?.role || role;
  const roleText = userType === "admin" || userType === "admin_employee"
    ? "Admin Account"
    : `${userType} account`;

  const handleLogout = async () => {
    await logout();
    window.location.href = `/${role === "admin" ? "admin" : role === "seller" ? "seller" : "buyer"}/login`;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">

      <main className="mx-auto grid max-w-[1440px] gap-8 px-5 py-10 md:px-[5vw] lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="self-start rounded-lg border border-slate-200 bg-white p-5 lg:sticky lg:top-28">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-5">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-50 text-[#2563eb]">
              <RoleIcon size={19} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{user?.fullName}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{roleText}</p>
            </div>
          </div>
          <nav className="mt-5 space-y-2" aria-label={`${role} dashboard navigation`}>
            {onSelectTab ? (
              <button
                type="button"
                onClick={() => onSelectTab("main")}
                className={`w-full flex items-center gap-2 rounded px-3 py-3 text-xs font-bold transition-colors ${
                  activeTab !== "support"
                    ? "bg-[#0f172a] text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <LayoutDashboard size={15} /> Dashboard
              </button>
            ) : (
              <Link
                href={`/${role}/dashboard`}
                className="flex items-center gap-2 rounded bg-[#0f172a] px-3 py-3 text-xs font-bold text-white"
              >
                <LayoutDashboard size={15} /> Dashboard
              </Link>
            )}

            {role !== "admin" && (
              <Link
                href={`/${role}/profile`}
                className="flex items-center gap-2 rounded px-3 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                <UserCheck size={15} /> Profile & Verification
              </Link>
            )}

            {(role !== "admin" || userType === "admin") && <Link href={`/${role}/orders`} className="flex items-center gap-2 rounded px-3 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-100">
              <ClipboardList size={15} /> Orders
            </Link>}
            <Link href="/notifications" className="flex items-center justify-between rounded px-3 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-100">
              <span className="flex items-center gap-2">
                <Bell size={15} /> Notifications
              </span>
              {unreadCount > 0 && (
                <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white shadow-xs">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
            {role === "admin" && userType === "admin" && <Link href="/admin/operations" className="flex items-center gap-2 rounded px-3 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"><UserCheck size={15}/> Disputes & reviews</Link>}
            {role === "admin" && userType === "admin" && <Link href="/admin/employees" className="flex items-center gap-2 rounded px-3 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"><UserRound size={15}/> Employee permissions</Link>}

            <Link
              href="/auctions"
              className="flex items-center gap-2 rounded px-3 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              <Gavel size={15} /> Public auctions
            </Link>

            {role !== "admin" && (
              <button
                type="button"
                onClick={() => {
                  if (onSelectTab) {
                    onSelectTab("support");
                  } else {
                    window.location.href = "/contact";
                  }
                }}
                className={`w-full flex items-center gap-2 rounded px-3 py-3 text-xs font-bold transition-colors ${
                  activeTab === "support"
                    ? "bg-[#0f172a] text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <LifeBuoy size={15} className={activeTab === "support" ? "text-white" : "text-[#2563eb]"} /> Support & Complaints
              </button>
            )}

            {sidebarExtra}

            <div className="pt-3 border-t border-slate-100 mt-3">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors text-left"
              >
                <LogOut size={15} /> Log Out
              </button>
            </div>
          </nav>
        </aside>

        <section className="min-w-0">
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
