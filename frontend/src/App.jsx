import React, { useEffect, useState, Suspense } from "react";
import HomePage from "./home"; // Keep eager for optimal First Contentful Paint on the landing page
import { PAGE, resolveRoute } from "./routes";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { useAuth } from "./auth/AuthContext";
import { Brand, Link } from "./components";
import { LoadingState } from "./components/AsyncState";

const AuctionListingPage = React.lazy(() => import("./auction"));
const HowItWorksPage = React.lazy(() => import("./how-it-works"));
const AboutPage = React.lazy(() => import("./about"));
const ContactPage = React.lazy(() => import("./contact"));
const AuthenticationPage = React.lazy(() => import("./auth"));
const ProductBiddingPage = React.lazy(() => import("./auction-detail"));
const AdminDashboardPage = React.lazy(() => import("./dashboard").then(m => ({ default: m.AdminDashboardPage })));
const BuyerDashboardPage = React.lazy(() => import("./dashboard").then(m => ({ default: m.BuyerDashboardPage })));
const SellerDashboardPage = React.lazy(() => import("./dashboard").then(m => ({ default: m.SellerDashboardPage })));
const BuyerProfilePage = React.lazy(() => import("./profile/BuyerProfilePage"));
const SellerProfilePage = React.lazy(() => import("./profile/SellerProfilePage"));
const OrderCenterPage = React.lazy(() => import("./commerce/OrderCenterPage"));
const NotificationsPage = React.lazy(() => import("./commerce/NotificationsPage"));
const ReviewsPage = React.lazy(() => import("./commerce/ReviewsPage"));
const ForgotPasswordPage = React.lazy(() => import("./auth/ForgotPasswordPage"));
const LegalPage = React.lazy(() => import("./legal/LegalPage"));
const AdminOperationsPage = React.lazy(() => import("./admin/AdminOperationsPage"));
const AdminEmployeePortalPage = React.lazy(() => import("./admin/AdminEmployeePortalPage"));
const AdminEmployeesPage = React.lazy(() => import("./admin/AdminEmployeesPage"));

import { ErrorBoundary } from "./components/ErrorBoundary";

/**
 * Return true when a click should be handled by this app's lightweight router.
 * External links, downloads, new-tab clicks and modified clicks keep the
 * browser's normal behaviour.
 */
function isInternalNavigation(event, anchor) {
  if (!anchor || event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return false;
  if (anchor.target || anchor.hasAttribute("download")) return false;

  const href = anchor.getAttribute("href");
  return Boolean(href?.startsWith("/") && !href.startsWith("//"));
}

export function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);

    const handleClick = (event) => {
      const anchor = event.target.closest("a");
      if (!isInternalNavigation(event, anchor)) return;

      event.preventDefault();
      window.history.pushState(null, "", anchor.getAttribute("href"));
      setPath(window.location.pathname);
      window.scrollTo({ top: 0, left: 0 });
    };

    document.addEventListener("click", handleClick);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  const route = resolveRoute(path);

  const content = (() => {
    switch (route.page) {
      case PAGE.BUYER_DASHBOARD:
        return (
          <ProtectedRoute role="buyer">
            <BuyerDashboardPage />
          </ProtectedRoute>
        );
      case PAGE.SELLER_DASHBOARD:
        return (
          <ProtectedRoute role="seller">
            <SellerDashboardPage />
          </ProtectedRoute>
        );
      case PAGE.ADMIN_DASHBOARD:
        return (
          <ProtectedRoute role="admin">
            <AdminPortal />
          </ProtectedRoute>
        );
      case PAGE.BUYER_PROFILE:
        return (
          <ProtectedRoute role="buyer">
            <BuyerProfilePage />
          </ProtectedRoute>
        );
      case PAGE.SELLER_PROFILE:
        return (
          <ProtectedRoute role="seller">
            <SellerProfilePage />
          </ProtectedRoute>
        );
      case PAGE.ADMIN_OPERATIONS:
        return (
          <ProtectedRoute role="admin">
            <AdminOperationsPage />
          </ProtectedRoute>
        );
      case PAGE.ADMIN_EMPLOYEES:
        return (
          <ProtectedRoute role="admin">
            <FullAdminOnly><AdminEmployeesPage /></FullAdminOnly>
          </ProtectedRoute>
        );
      case PAGE.ORDERS:
        return <ProtectedRoute><OrderCenterPage orderId={route.orderId} /></ProtectedRoute>;
      case PAGE.NOTIFICATIONS:
        return <ProtectedRoute><NotificationsPage /></ProtectedRoute>;
      case PAGE.REVIEWS:
        return <ProtectedRoute><ReviewsPage /></ProtectedRoute>;
      case PAGE.FORGOT_PASSWORD:
        return <ForgotPasswordPage />;
      case PAGE.TERMS:
        return <LegalPage type="terms" />;
      case PAGE.PRIVACY:
        return <LegalPage type="privacy" />;
      case PAGE.AUCTION_DETAIL:
        return <ProductBiddingPage slug={route.slug} />;
      case PAGE.AUCTIONS:
        return <AuctionListingPage />;
      case PAGE.LOGIN:
        return <AuthenticationPage initialMode="login" />;
      case PAGE.REGISTER:
        return <AuthenticationPage initialMode="register" />;
      case PAGE.ADMIN_LOGIN:
        return <AuthenticationPage initialMode="admin-login" />;
      case PAGE.HOW_IT_WORKS:
        return <HowItWorksPage />;
      case PAGE.ABOUT:
        return <AboutPage />;
      case PAGE.CONTACT:
        return <ContactPage />;
      case PAGE.HOME:
        return (
          <div className="app-container">
            <HomePage />
          </div>
        );
      default:
        return (
          <main className="grid min-h-screen place-items-center bg-[#f8fafc] px-5 text-center">
            <section>
              <Brand />
              <h1 className="mt-7 text-4xl font-bold text-[#0f172a]">Page not found</h1>
              <p className="mt-3 text-sm text-slate-600">The requested bidmylot page does not exist yet.</p>
              <Link href="/" className="mt-6 inline-flex rounded bg-[#2563eb] px-5 py-3 text-xs font-bold text-white">
                Return home
              </Link>
            </section>
          </main>
        );
    }
  })();

  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <main className="grid min-h-screen place-items-center bg-[#f8fafc] px-5">
            <LoadingState label="Loading page…" />
          </main>
        }
      >
        {content}
      </Suspense>
    </ErrorBoundary>
  );
}

function AdminPortal() {
  const { user } = useAuth();
  return user?.accountType === "admin_employee" ? <AdminEmployeePortalPage /> : <AdminDashboardPage />;
}

function FullAdminOnly({ children }) {
  const { user } = useAuth();
  if (user?.accountType === "admin") return children;
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-5"><section className="rounded border bg-white p-8 text-center"><h1 className="text-2xl font-bold">Full administrator required</h1><p className="mt-3 text-sm text-slate-600">Employee accounts cannot manage other employee permissions.</p><Link href="/admin/dashboard" className="mt-5 inline-flex rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white">Return to employee portal</Link></section></main>;
}

export default App;
