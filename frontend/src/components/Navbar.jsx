import React, { useEffect, useState } from "react";
import { Bell, LogOut, Menu, X } from "lucide-react";
import Link from "./Link";
import Brand from "./Brand";
import { useAuth } from "../auth/AuthContext";
import { useNotificationCount } from "../hooks/useNotificationCount";

const NAVIGATION = [
  ["Home", "/"],
  ["Auctions", "/auctions"],
  ["How It Works", "/how-it-works"],
  ["About", "/about"],
  ["Support", "/support"],
];

function isNavActive(label, href) {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  if (label === "Home") return path === "/" || path === "";
  if (label === "Auctions") return path.startsWith("/auctions");
  if (label === "How It Works")
    return path.startsWith("/how-it-works") || path.startsWith("/how-we-sell");
  if (label === "Sell")
    return path.startsWith("/sell") && !path.startsWith("/seller");
  return path.startsWith(href);
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { unreadCount } = useNotificationCount();

  const signOut = async () => {
    await logout();
    window.location.assign("/");
  };

  const userType = user?.accountType || user?.role || "buyer";
  const dashboardHref =
    userType === "admin" || userType === "admin_employee"
      ? "/admin/dashboard"
      : userType === "seller"
        ? "/seller/dashboard"
        : "/buyer/dashboard";

  useEffect(() => {
    const close = (event) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  return (
    <>
      <div className="flex min-h-9 items-center justify-center bg-[#0f172a] px-5 py-2 text-center text-[11px] text-slate-200 sm:justify-between sm:px-[5vw]">
        <p className="font-semibold tracking-wide">
          Independent Auction Marketplace — Clear bidding and listings without unneeded steps.
        </p>
        <div className="hidden items-center gap-4 sm:flex">
          <Link href="/how-it-works" className="hover:text-white transition-colors">
            Process Overview
          </Link>
          <span className="text-slate-600">•</span>
          <Link href="/support" className="hover:text-white transition-colors">
            Support Desk
          </Link>
        </div>
      </div>
      <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur-md sm:px-[5vw]">
        <Brand />
        <nav aria-label="Main navigation" className="hidden items-center gap-7 xl:flex">
          {NAVIGATION.map(([label, href]) => {
            const active = isNavActive(label, href);
            return (
              <Link
                key={label}
                href={href}
                className={`text-[14px] transition-colors ${active
                    ? "font-bold text-[#2563eb]"
                    : "font-semibold text-slate-700 hover:text-[#2563eb]"
                  }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 text-xs font-semibold">
          {user ? (
            <>
              <Link
                className="relative hidden items-center gap-1.5 rounded-[4px] p-2 text-slate-700 hover:text-[#2563eb] transition-colors sm:inline-flex"
                href="/notifications"
                aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
              >
                <Bell size={17} />
                {unreadCount > 0 && (
                  <span className="absolute 0 top-0.5 right-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[9px] font-extrabold text-white shadow-xs">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link
                className="hidden text-slate-700 hover:text-[#2563eb] sm:inline"
                href={dashboardHref}
              >
                Dashboard
              </Link>
              {userType === "seller" && (
                <Link
                  className="hidden min-h-9 items-center rounded-[4px] bg-[#0f172a] px-3 text-xs font-semibold text-white transition-colors hover:bg-slate-800 md:flex"
                  href="/seller/dashboard"
                >
                  My Listings
                </Link>
              )}
              <button
                type="button"
                onClick={signOut}
                className="hidden items-center gap-1.5 border-l border-slate-300 pl-4 text-slate-700 hover:text-[#2563eb] md:flex"
              >
                <LogOut size={14} /> Log Out
              </button>
            </>
          ) : (
            <>
              <Link
                className="hidden text-slate-700 hover:text-[#2563eb] sm:inline"
                href="/login"
              >
                Log In
              </Link>
              <Link
                className="hidden border-l border-slate-300 pl-4 text-slate-700 hover:text-[#2563eb] md:inline"
                href="/register"
              >
                Register
              </Link>
              <Link
                className="hidden min-h-10 items-center rounded-[4px] bg-[#2563eb] px-4 text-white transition-colors hover:bg-[#1d4ed8] md:flex"
                href="/register?role=seller"
              >
                List an Item
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="grid h-10 w-10 place-items-center rounded-[4px] border border-slate-300 bg-white text-[#0f172a] xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>
      <nav
        id="mobile-navigation"
        aria-label="Mobile navigation"
        aria-hidden={!open}
        className={`${open ? "flex" : "hidden"
          } absolute left-0 right-0 z-40 flex-col border-b border-slate-200 bg-white px-5 py-4 shadow-xl xl:hidden`}
      >
        {NAVIGATION.map(([label, href]) => {
          const active = isNavActive(label, href);
          return (
            <Link
              key={label}
              href={href}
              onClick={() => setOpen(false)}
              className={`border-b border-slate-200 py-3 text-sm ${active ? "font-bold text-[#2563eb]" : "text-slate-700"
                }`}
            >
              {label}
            </Link>
          );
        })}
        <div className="mt-4 flex flex-col gap-3 pt-2">
          {user ? (
            <>
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center justify-between rounded-[4px] border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700"
              >
                <span className="flex items-center gap-2">
                  <Bell size={16} /> Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1.5 text-[10px] font-extrabold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link
                href={dashboardHref}
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center justify-center rounded-[4px] bg-[#2563eb] text-sm font-bold text-white"
              >
                Go to Dashboard
              </Link>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="flex min-h-11 items-center justify-center gap-2 rounded-[4px] border border-slate-300 text-sm font-bold text-slate-700"
              >
                <LogOut size={16} /> Log Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center justify-center rounded-[4px] border border-slate-300 text-sm font-bold text-[#0f172a]"
              >
                Log In
              </Link>
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center justify-center rounded-[4px] bg-[#2563eb] text-sm font-bold text-white"
              >
                Register Account
              </Link>
            </>
          )}
        </div>
      </nav>
    </>
  );
}
