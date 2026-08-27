import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Ban, Check, CheckCircle2, Copy, Mail, Phone, RefreshCw, Star, XCircle } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { DashboardLayout, DashboardSection } from "../dashboard/DashboardLayout";
import api from "../lib/api";
import { errorMessage, formatCurrency, formatDateTime } from "../lib/format";

const activeStatuses = new Set(["confirmed", "completed"]);

function ContactCard({ title, details, accent, orderReference, isCancelled = false }) {
  const [copied, setCopied] = useState("");
  if (!details) return null;
  const copy = async (value, key) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1500);
  };
  const name = details.businessName || details.legalName || details.name || title;
  return (
    <section className={`rounded-2xl border p-4 transition-all ${isCancelled ? "border-slate-200 bg-slate-50/70 opacity-80" : accent}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
        {isCancelled && (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-600">
            Inactive
          </span>
        )}
      </div>
      <p className="mt-1 text-sm font-bold text-slate-800">{name}</p>
      <p className="text-xs capitalize text-slate-500">{details.sellerType || details.buyerType || "verified account"}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-3 border border-slate-100">
          <p className="text-[10px] font-bold uppercase text-slate-500">Phone</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{details.phone || "Not provided"}</p>
          {details.phone && !isCancelled && (
            <div className="mt-2 flex gap-2">
              <a className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800 transition" href={`tel:${details.phone}`}><Phone size={12}/>Call</a>
              <button type="button" onClick={() => copy(details.phone, "phone")} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold hover:bg-slate-50 transition"><Copy size={12}/>{copied === "phone" ? "Copied" : "Copy"}</button>
            </div>
          )}
        </div>
        <div className="rounded-xl bg-white p-3 border border-slate-100">
          <p className="text-[10px] font-bold uppercase text-slate-500">Email</p>
          <p className="mt-1 break-all text-sm font-semibold text-slate-900">{details.email || "Not provided"}</p>
          {details.email && !isCancelled && (
            <div className="mt-2 flex gap-2">
              <a className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700 transition" href={`mailto:${details.email}?subject=BidMyLot deal ${orderReference}`}><Mail size={12}/>Email</a>
              <button type="button" onClick={() => copy(details.email, "email")} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold hover:bg-slate-50 transition"><Copy size={12}/>{copied === "email" ? "Copied" : "Copy"}</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function OrderCenterPage({ orderId }) {
  const { user } = useAuth();
  const accountType = user?.accountType || "buyer";
  const layoutRole = ["admin", "admin_employee"].includes(accountType) ? "admin" : accountType;
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (orderId) {
        const { data } = await api.get(`/orders/${orderId}`);
        setOrders([data.data]);
        setSelected(data.data);
      } else {
        const endpoint = layoutRole === "admin" ? "/orders/admin" : `/orders/${layoutRole}`;
        const { data } = await api.get(endpoint);
        const items = data.data || [];
        setOrders(items);
        setSelected((current) => items.find((item) => item.id === current?.id) || items[0] || null);
      }
    } catch (requestError) {
      setError(errorMessage(requestError, "Confirmed deals could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [layoutRole, orderId]);

  useEffect(() => { void load(); }, [load]);

  const selectOrder = async (order) => {
    setSelected(order);
    try {
      const { data } = await api.get(`/orders/${order.id}`);
      setSelected(data.data);
    } catch (requestError) {
      setError(errorMessage(requestError, "Deal details could not be loaded."));
    }
  };

  const mutate = async (request, success) => {
    setBusy(true); setError(""); setNotice("");
    try { await request(); setNotice(success); await load(); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setBusy(false); }
  };

  const confirmComplete = () => mutate(
    () => api.post(`/orders/${selected.id}/complete`, { note: `${accountType} confirmed completion` }),
    "Your completion confirmation was recorded. The deal closes after both parties confirm.",
  );

  const cancel = () => {
    const reason = window.prompt("Why is this confirmed deal being cancelled?");
    if (!reason?.trim()) return;
    void mutate(() => api.post(`/orders/${selected.id}/cancel`, { reason: reason.trim() }), "Deal cancelled.");
  };

  const dispute = () => {
    const details = window.prompt("Describe the issue (at least 10 characters).");
    if (!details?.trim()) return;
    void mutate(() => api.post(`/disputes/orders/${selected.id}/dispute`, { reason: "other", details: details.trim() }), "Dispute opened for review.");
  };

  const review = () => {
    const comment = window.prompt("Write your review (at least 5 characters).");
    if (!comment?.trim()) return;
    const rating = Number(window.prompt("Rating from 1 to 5", "5"));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) { setError("Rating must be from 1 to 5."); return; }
    const isBuyer = accountType === "buyer";
    const categoryRatings = isBuyer
      ? { productAccuracy: rating, communication: rating, transactionCooperation: rating, overallExperience: rating }
      : { agreementReliability: rating, communication: rating, transactionCooperation: rating };
    const suffix = isBuyer ? "buyer-review" : "seller-review";
    void mutate(() => api.post(`/reviews/orders/${selected.id}/${suffix}`, { ratingScore: rating, categoryRatings, comment: comment.trim() }), "Review submitted.");
  };

  if (loading) return <DashboardLayout role={layoutRole} title="Order Centre" description="Confirmed deals and direct contact."><LoadingState label="Loading confirmed deals…"/></DashboardLayout>;

  const isParty = accountType === "buyer" || accountType === "seller";
  const isCancelled = selected?.orderStatus === "cancelled";
  const myCompletion = accountType === "buyer" ? selected?.buyerCompletedAt : selected?.sellerCompletedAt;
  const myReview = accountType === "buyer" ? selected?.buyerReview : selected?.sellerReview;

  return (
    <DashboardLayout role={layoutRole} title="Order Centre" description="After a deal is confirmed, buyer and seller contact each other directly. BidMyLot does not process payment or delivery.">
      {error && <ErrorState message={error} onRetry={load}/>} 
      {notice && <div className="mb-5 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18}/>{notice}</div>}
      <div className="mb-5 flex justify-end"><button type="button" disabled={busy} onClick={load} className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-xs font-bold"><RefreshCw size={14}/>Refresh</button></div>
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <DashboardSection title={`Deals & Orders (${orders.length})`} description="Select a deal to view details and status.">
          <div className="space-y-2">
            {!orders.length && <p className="text-sm text-slate-500">No deals found.</p>}
            {orders.map((order) => {
              const isItemCancelled = order.orderStatus === "cancelled";
              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => selectOrder(order)}
                  className={`w-full rounded-xl border p-3 text-left transition-all ${
                    selected?.id === order.id
                      ? isItemCancelled
                        ? "border-red-500 bg-red-50/70 shadow-xs"
                        : "border-blue-600 bg-blue-50 shadow-xs"
                      : isItemCancelled
                        ? "bg-slate-50/70 border-slate-200 opacity-85 hover:bg-red-50/40 hover:border-red-200"
                        : "bg-white border-slate-200 hover:border-blue-200"
                  }`}
                >
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-slate-500">{order.orderReference}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        isItemCancelled
                          ? "bg-red-600 text-white shadow-2xs"
                          : order.orderStatus === "completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {order.orderStatus}
                    </span>
                  </div>
                  <p className={`mt-2 truncate text-sm font-bold ${isItemCancelled ? "text-slate-700 line-through decoration-red-400" : "text-slate-900"}`}>
                    {order.listingDetails?.title || "Marketplace deal"}
                  </p>
                  <p className={`mt-1 text-xs font-bold ${isItemCancelled ? "text-slate-500" : "text-blue-700"}`}>
                    {formatCurrency(order.totalAmount, order.currency)}
                    {isItemCancelled && <span className="ml-1 text-[10px] font-normal text-red-600">(Voided)</span>}
                  </p>
                </button>
              );
            })}
          </div>
        </DashboardSection>
        <DashboardSection
          title={selected?.orderReference || "Deal Details"}
          description={selected ? (isCancelled ? `Cancelled Deal • Registered ${formatDateTime(selected.createdAt)}` : `Confirmed ${formatDateTime(selected.createdAt)}`) : "Select a deal."}
        >
          {selected && (
            <div className="space-y-5">
              {/* BIG CANCELLED BANNER FOR CANCELLED DEALS */}
              {isCancelled && (
                <div className="relative overflow-hidden rounded-2xl border-2 border-red-300 bg-gradient-to-br from-red-50 via-rose-50 to-red-100/70 p-6 shadow-xs">
                  {/* Background Watermark */}
                  <div className="pointer-events-none absolute right-2 -bottom-4 select-none font-black text-6xl md:text-8xl tracking-widest text-red-500/10 uppercase rotate-[-5deg]">
                    CANCELLED
                  </div>

                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-600 text-white shadow-md">
                        <Ban size={26} strokeWidth={2.5} />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-red-600 px-3 py-0.5 text-xs font-black uppercase tracking-wider text-white shadow-2xs">
                            DEAL CANCELLED
                          </span>
                          <span className="text-xs font-mono font-bold text-red-700">
                            {selected.orderReference}
                          </span>
                        </div>
                        <h2 className="mt-1.5 text-xl font-black text-red-950">
                          This Deal Was Cancelled
                        </h2>
                        <p className="mt-1 text-xs sm:text-sm text-red-900/80 leading-relaxed max-w-xl">
                          This transaction has been terminated. Direct coordination, payment arrangements, and lot dispatch between buyer and seller are closed.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-red-200 bg-white/95 p-3 text-right backdrop-blur-xs shrink-0 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 block">
                        Final Status
                      </span>
                      <span className="text-xs font-black text-red-900 block mt-0.5">
                        VOID / NO PAYMENT DUE
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Deal Transaction Details Box */}
              <div
                className={`rounded-2xl border p-5 transition-all ${
                  isCancelled
                    ? "border-red-200 bg-red-50/40 text-slate-800"
                    : "border-blue-200 bg-blue-50 text-slate-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-base">
                    {isCancelled ? "Cancelled Deal Record" : "Direct contact is active"}
                  </h3>
                  {isCancelled && (
                    <span className="rounded-full bg-red-100 text-red-800 border border-red-200 px-2.5 py-0.5 text-[11px] font-black uppercase">
                      Cancelled
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {isCancelled
                    ? "The original accepted amount is retained below for transaction audit records. No payment or product handoff should occur."
                    : "The accepted amount is recorded below. Buyer and seller arrange all remaining steps privately. Never share passwords or OTP codes."}
                </p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-white/80 p-3 border border-slate-200/70">
                    <dt className="text-[10px] font-bold uppercase text-slate-500">Quantity</dt>
                    <dd className="text-sm font-bold text-slate-900 mt-0.5">{selected.quantity}</dd>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3 border border-slate-200/70">
                    <dt className="text-[10px] font-bold uppercase text-slate-500">Unit value</dt>
                    <dd className="text-sm font-bold text-slate-900 mt-0.5">{formatCurrency(selected.unitPrice, selected.currency)}</dd>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3 border border-slate-200/70">
                    <dt className="text-[10px] font-bold uppercase text-slate-500">
                      {isCancelled ? "Voided Value" : "Agreed value"}
                    </dt>
                    <dd className={`text-base font-black mt-0.5 ${isCancelled ? "text-slate-500 line-through decoration-red-500" : "text-[#2563eb]"}`}>
                      {formatCurrency(selected.totalAmount, selected.currency)}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Contact Information Cards */}
              {accountType === "buyer" && (
                <ContactCard
                  title="Seller contact"
                  details={selected.sellerDetails}
                  accent="border-blue-200 bg-blue-50/50"
                  orderReference={selected.orderReference}
                  isCancelled={isCancelled}
                />
              )}
              {accountType === "seller" && (
                <ContactCard
                  title="Buyer contact"
                  details={selected.buyerDetails}
                  accent="border-emerald-200 bg-emerald-50/50"
                  orderReference={selected.orderReference}
                  isCancelled={isCancelled}
                />
              )}
              {layoutRole === "admin" && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <ContactCard
                    title="Buyer contact"
                    details={selected.buyerDetails}
                    accent="border-emerald-200 bg-emerald-50/50"
                    orderReference={selected.orderReference}
                    isCancelled={isCancelled}
                  />
                  <ContactCard
                    title="Seller contact"
                    details={selected.sellerDetails}
                    accent="border-blue-200 bg-blue-50/50"
                    orderReference={selected.orderReference}
                    isCancelled={isCancelled}
                  />
                </div>
              )}

              {/* Completion & Execution Timeline Block */}
              <div
                className={`rounded-xl border p-4 text-xs ${
                  isCancelled
                    ? "bg-red-50/30 border-red-200 text-slate-700"
                    : "bg-slate-50 border-slate-200 text-slate-700"
                }`}
              >
                {isCancelled ? (
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-1.5 font-bold text-red-700">
                      <Ban size={14} /> Deal Terminated
                    </p>
                    <p className="text-slate-600">
                      This order was cancelled. Completion confirmations, reviews, and dispute submissions are deactivated.
                    </p>
                  </div>
                ) : (
                  <>
                    <p><strong>Buyer completion:</strong> {selected.buyerCompletedAt ? formatDateTime(selected.buyerCompletedAt) : "Awaiting confirmation"}</p>
                    <p className="mt-1"><strong>Seller completion:</strong> {selected.sellerCompletedAt ? formatDateTime(selected.sellerCompletedAt) : "Awaiting confirmation"}</p>
                  </>
                )}
              </div>

              {/* Action Buttons Bar */}
              <div className="flex flex-wrap items-center gap-3">
                {isCancelled ? (
                  <div className="inline-flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs font-bold text-red-800">
                    <Ban size={15} /> Deal Cancelled & Closed
                  </div>
                ) : (
                  <>
                    {isParty && selected.orderStatus === "confirmed" && !myCompletion && (
                      <button type="button" disabled={busy} onClick={confirmComplete} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-700 transition">
                        <Check size={15}/>Confirm my side is complete
                      </button>
                    )}
                    {isParty && selected.orderStatus === "confirmed" && (
                      <button type="button" disabled={busy} onClick={cancel} className="inline-flex items-center gap-2 rounded-xl border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2.5 text-xs font-bold transition">
                        <XCircle size={15}/>Cancel deal
                      </button>
                    )}
                    {isParty && activeStatuses.has(selected.orderStatus) && (
                      <button type="button" disabled={busy} onClick={dispute} className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 px-4 py-2.5 text-xs font-bold transition">
                        <AlertTriangle size={15}/>Open dispute
                      </button>
                    )}
                    {isParty && selected.orderStatus === "completed" && !myReview && (
                      <button type="button" disabled={busy} onClick={review} className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-700 transition">
                        <Star size={15}/>Leave review
                      </button>
                    )}
                    {myReview && (
                      <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-bold text-emerald-800">
                        <CheckCircle2 size={15}/>Review submitted
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </DashboardSection>
      </div>
    </DashboardLayout>
  );
}
