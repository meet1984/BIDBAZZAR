import React, { useEffect } from "react";
import { Link } from "../components";
import { useAuth } from "./AuthContext";

export function ProtectedRoute({ role, children }) {
  const { user, initializing } = useAuth();

  useEffect(() => {
    if (!initializing && !user) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      const loginPath = role === "seller" ? "/seller/login" : role === "admin" ? "/admin/login" : "/buyer/login";
      window.location.assign(`${loginPath}?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [initializing, user, role]);

  if (initializing || !user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f8fafc] px-5 text-sm text-slate-600">
        Checking your bidmylot session…
      </main>
    );
  }

  const userType = user.accountType || user.role || "buyer";
  const hasCapability =
    role === "admin"
      ? userType === "admin" || userType === "admin_employee"
      : role === "seller"
        ? userType === "seller"
        : role === "buyer"
          ? userType === "buyer"
          : true;

  if (!hasCapability) {
    const fallbackDashboard =
      userType === "admin" || userType === "admin_employee"
        ? "/admin/dashboard"
        : userType === "seller"
          ? "/seller/dashboard"
          : "/buyer/dashboard";

    return (
      <main className="grid min-h-screen place-items-center bg-[#f8fafc] px-5">
        <section className="max-w-lg rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-[#0f172a]">Access Restricted</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your account type ({userType}) is not authorized to access this dashboard.
          </p>
          <Link
            href={fallbackDashboard}
            className="mt-6 inline-flex rounded bg-[#2563eb] px-5 py-3 text-xs font-bold text-white"
          >
            Go to your {userType} dashboard
          </Link>
        </section>
      </main>
    );
  }

  return children;
}
