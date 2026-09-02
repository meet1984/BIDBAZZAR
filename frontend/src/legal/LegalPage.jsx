import React, { useEffect, useState } from "react";
import {
  FileText,
  ShieldCheck,
  Clock,
  Printer,
  HelpCircle,
  ChevronRight,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Footer, Navbar, Link } from "../components";
import { LoadingState } from "../components/AsyncState";
import api from "../lib/api";
import { formatDateTime } from "../lib/format";

const FALLBACK_PAGES = {
  terms: {
    title: "Marketplace Terms & Conditions",
    contentHtml: `<h2>1. Marketplace Overview & Account Accuracy</h2>
<p>BidMyLot is a dedicated auction and offer marketplace connecting buyers and sellers for negotiated single-unit and multi-unit lots. All users must provide accurate, verifiable account details and listing information at all times.</p>
<h2>2. Offers, Negotiations & Agreements</h2>
<p>Offers and bids placed on BidMyLot are private between the buyer, seller, and authorized marketplace administrators. A confirmed offer or allocation creates a direct, binding transaction agreement between the buyer and seller.</p>
<h2>3. Settlement & Logistics</h2>
<p>BidMyLot facilitates listing discovery, offer negotiation, and deal confirmation. BidMyLot does not process direct payments, delivery, or logistics collection. Parties are directly responsible for executing settlement and delivery as agreed.</p>
<h2>4. Prohibited Activities</h2>
<p>Fraud, price manipulation, shill bidding, self-offering, harassment, and unauthorized system access are strictly prohibited. Violations will result in immediate account suspension and potential legal action.</p>
<h2>5. Reviews & Dispute Resolution</h2>
<p>All dispute actions and transaction reviews must reflect genuine transactions. The marketplace administration reserves the right to moderate reviews and oversee dispute resolution according to platform policies.</p>`,
    updatedAt: new Date().toISOString(),
  },
  privacy: {
    title: "Privacy Policy & Data Notice",
    contentHtml: `<h2>1. Information We Collect</h2>
<p>BidMyLot collects and processes account details, verification documents, listings, offers, orders, and inquiry information necessary to operate a secure marketplace.</p>
<h2>2. Document Privacy & Confidentiality</h2>
<p>Government identity and business verification documents are strictly private and accessible only through authorized, authenticated administrative endpoints for verification purposes.</p>
<h2>3. Public vs Private Profile Information</h2>
<p>Public marketplace profiles exclude private offer terms, confidential identity records, and direct contact details. Contact information is shared only between confirmed transaction counterparties and authorized administrators.</p>
<h2>4. Data Retention & Security</h2>
<p>Operational, transactional, and audit records are retained securely as required for security auditing, fraud prevention, dispute resolution, and legal compliance.</p>
<h2>5. Your Rights & Data Requests</h2>
<p>Users may review and update their profile details or contact BidMyLot support to request data corrections or account inquiries.</p>`,
    updatedAt: new Date().toISOString(),
  },
};

export default function LegalPage({ type = "terms" }) {
  const slug = type === "privacy" ? "privacy" : "terms";
  const [page, setPage] = useState(() => FALLBACK_PAGES[slug]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/legal-pages/${slug}`)
      .then((res) => {
        if (!isMounted) return;
        const data = res.data?.page || res.data;
        if (data) {
          setPage({
            title: data.title || FALLBACK_PAGES[slug].title,
            contentHtml: data.contentHtml || data.content_html || FALLBACK_PAGES[slug].contentHtml,
            updatedAt: data.updatedAt || FALLBACK_PAGES[slug].updatedAt,
          });
        }
      })
      .catch(() => {
        if (!isMounted) return;
        // Gracefully fall back to bundled default copy
        setPage(FALLBACK_PAGES[slug]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const isTerms = slug === "terms";

  return (
    <>
      <Navbar />

      <main className="min-h-[75vh] bg-[#f8fafc] py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          {/* Breadcrumbs & Category Pill */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Link href="/" className="hover:text-blue-600 transition-colors">
                Home
              </Link>
              <ChevronRight size={13} className="text-slate-400" />
              <span className="text-slate-800">Legal & Policy</span>
              <ChevronRight size={13} className="text-slate-400" />
              <span className="font-bold text-blue-600">{page.title}</span>
            </nav>

            {/* Quick Switch Tabs */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-2xs">
              <Link
                href="/terms"
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                  isTerms
                    ? "bg-[#2563eb] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ShieldCheck size={13} />
                <span>Terms</span>
              </Link>
              <Link
                href="/privacy"
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                  !isTerms
                    ? "bg-[#2563eb] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileText size={13} />
                <span>Privacy</span>
              </Link>
            </div>
          </div>

          {/* Hero Header */}
          <header className="mt-8 border-b border-slate-200 pb-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold tracking-wider uppercase text-blue-600">
              {isTerms ? <ShieldCheck size={14} /> : <FileText size={14} />}
              <span>Official BidMyLot Policy</span>
            </div>
            <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              {page.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-slate-400" />
                <span>
                  Last modified: <strong>{formatDateTime(page.updatedAt)}</strong>
                </span>
              </div>

              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition-colors print:hidden"
              >
                <Printer size={13} />
                <span>Print Document</span>
              </button>
            </div>
          </header>

          {/* Error Notice if any */}
          {error && (
            <div className="mt-6 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900">
              <AlertCircle size={16} className="text-amber-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Main Legal Content Container */}
          <article className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-xs">
            {loading ? (
              <div className="py-12">
                <LoadingState label="Loading policy content…" />
              </div>
            ) : (
              <div
                className="legal-rendered-content text-sm leading-7 text-slate-700 prose prose-slate max-w-none [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:border-b [&_h2]:border-slate-100 [&_h2]:pb-2 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-slate-900 [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:text-slate-600 [&_p]:leading-7 [&_p]:mb-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:text-slate-600 [&_li]:my-1.5 [&_strong]:text-slate-900 [&_strong]:font-bold [&_a]:text-blue-600 [&_a]:underline hover:[&_a]:text-blue-800"
                dangerouslySetInnerHTML={{
                  __html: page.contentHtml || "<p>No content available.</p>",
                }}
              />
            )}
          </article>

          {/* Footer Contact Support Card */}
          <aside className="mt-10 rounded-xl border border-blue-100 bg-blue-50/60 p-6 sm:p-8 text-center print:hidden">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-blue-100 text-blue-600">
              <HelpCircle size={20} />
            </div>
            <h2 className="mt-3 text-base font-bold text-slate-900">
              Have questions about our {isTerms ? "terms" : "privacy policy"}?
            </h2>
            <p className="mt-1 text-xs text-slate-600 max-w-md mx-auto">
              Our marketplace support team is available to assist you with account verification, compliance, or inquiry concerns.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-xs"
              >
                Contact Support
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Return to Marketplace
              </Link>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </>
  );
}
