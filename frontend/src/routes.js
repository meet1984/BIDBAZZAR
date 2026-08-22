/**
 * Route names used by the client-side router in App.jsx.
 */
export const PAGE = Object.freeze({
  HOME: "home",
  AUCTIONS: "auctions",
  AUCTION_DETAIL: "auction-detail",
  LOGIN: "login",
  REGISTER: "register",
  ADMIN_LOGIN: "admin-login",
  HOW_IT_WORKS: "how-it-works",
  ABOUT: "about",
  CONTACT: "contact",
  BUYER_DASHBOARD: "buyer-dashboard",
  SELLER_DASHBOARD: "seller-dashboard",
  ADMIN_DASHBOARD: "admin-dashboard",
  ADMIN_OPERATIONS: "admin-operations",
  ADMIN_EMPLOYEES: "admin-employees",
  BUYER_PROFILE: "buyer-profile",
  SELLER_PROFILE: "seller-profile",
  ORDERS: "orders",
  NOTIFICATIONS: "notifications",
  REVIEWS: "reviews",
  FORGOT_PASSWORD: "forgot-password",
  TERMS: "terms",
  PRIVACY: "privacy",
  NOT_FOUND: "not-found",
});

const startsWithAny = (pathname, prefixes) =>
  prefixes.some((prefix) => pathname.startsWith(prefix));

export function resolveRoute(pathname) {
  const path = pathname || "/";

  if (path === "/admin/login" || path === "/admin/login/") {
    return { page: PAGE.ADMIN_LOGIN };
  }

  if (path === "/buyer/dashboard" || path === "/buyer/dashboard/") {
    return { page: PAGE.BUYER_DASHBOARD };
  }
  if (path === "/seller/dashboard" || path === "/seller/dashboard/") {
    return { page: PAGE.SELLER_DASHBOARD };
  }
  if (path === "/admin/dashboard" || path === "/admin/dashboard/") {
    return { page: PAGE.ADMIN_DASHBOARD };
  }

  if (path === "/buyer/profile" || path === "/buyer/profile/") {
    return { page: PAGE.BUYER_PROFILE };
  }
  if (path === "/seller/profile" || path === "/seller/profile/") {
    return { page: PAGE.SELLER_PROFILE };
  }

  if (path === "/admin/operations" || path === "/admin/operations/") {
    return { page: PAGE.ADMIN_OPERATIONS };
  }
  if (path === "/admin/employees" || path === "/admin/employees/") {
    return { page: PAGE.ADMIN_EMPLOYEES };
  }

  const orderMatch = path.match(/^\/(?:buyer\/orders|seller\/orders|admin\/orders|orders)(?:\/(\d+))?\/?$/);
  if (orderMatch) return { page: PAGE.ORDERS, orderId: orderMatch[1] ? Number(orderMatch[1]) : null };
  if (path === "/notifications" || path === "/notifications/") return { page: PAGE.NOTIFICATIONS };
  if (path === "/reviews" || path === "/reviews/") return { page: PAGE.REVIEWS };
  if (path === "/forgot-password" || path === "/forgot-password/") return { page: PAGE.FORGOT_PASSWORD };
  if (path === "/terms" || path === "/terms/") return { page: PAGE.TERMS };
  if (path === "/privacy" || path === "/privacy/") return { page: PAGE.PRIVACY };

  const isNestedAuction =
    path.startsWith("/auctions/") && path !== "/auctions/";
  const isAuctionAlias = startsWithAny(path, [
    "/auction/",
    "/bid/",
    "/bidding/",
  ]);

  if (isNestedAuction || isAuctionAlias) {
    return {
      page: PAGE.AUCTION_DETAIL,
      slug: path.split("/").filter(Boolean).pop(),
    };
  }

  if (path === "/auctions" || path === "/auctions/") {
    return { page: PAGE.AUCTIONS };
  }

  if (startsWithAny(path, ["/login", "/signin", "/buyer/login", "/seller/login"])) {
    return { page: PAGE.LOGIN };
  }

  if (startsWithAny(path, ["/register", "/signup", "/buyer/register", "/seller/register"])) {
    return { page: PAGE.REGISTER };
  }

  if (startsWithAny(path, ["/how-it-works", "/how-we-sell", "/sell"])) {
    return { page: PAGE.HOW_IT_WORKS };
  }

  if (startsWithAny(path, ["/about", "/about-us"])) {
    return { page: PAGE.ABOUT };
  }

  if (startsWithAny(path, ["/contact", "/contact-us", "/support"])) {
    return { page: PAGE.CONTACT };
  }

  if (path === "/") return { page: PAGE.HOME };

  return { page: PAGE.NOT_FOUND };
}
