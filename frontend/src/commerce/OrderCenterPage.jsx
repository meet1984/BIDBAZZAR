import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, Mail, Phone, RefreshCw, Star, XCircle } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { DashboardLayout, DashboardSection } from "../dashboard/DashboardLayout";
import api from "../lib/api";
import { errorMessage, formatCurrency, formatDateTime } from "../lib/format";

const activeStatuses = new Set(["confirmed", "completed"]);

function ContactCard({ title, details, accent, orderReference }) {
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
    <section className={`rounded-2xl border p-4 ${accent}`}>
      <h3 className="text-sm font-black text-slate-900">{title}</h3>
      <p className="mt-1 text-sm font-bold text-slate-800">{name}</p>
      <p className="text-xs capitalize text-slate-500">{details.sellerType || details.buyerType || "verified account"}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-3">
          <p className="text-[10px] font-bold uppercase text-slate-500">Phone</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{details.phone || "Not provided"}</p>
          {details.phone && <div className="mt-2 flex gap-2">
            <a className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white" href={`tel:${details.phone}`}><Phone size={12}/>Call</a>
            <button type="button" onClick={() => copy(details.phone, "phone")} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold"><Copy size={12}/>{copied === "phone" ? "Copied" : "Copy"}</button>
          </div>}
        </div>
        <div className="rounded-xl bg-white p-3">
          <p className="text-[10px] font-bold uppercase text-slate-500">Email</p>
          <p className="mt-1 break-all text-sm font-semibold text-slate-900">{details.email || "Not provided"}</p>
          {details.email && <div className="mt-2 flex gap-2">
            <a className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white" href={`mailto:${details.email}?subject=BidMyLot deal ${orderReference}`}><Mail size={12}/>Email</a>
            <button type="button" onClick={() => copy(details.email, "email")} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold"><Copy size={12}/>{copied === "email" ? "Copied" : "Copy"}</button>
          </div>}
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
  const myCompletion = accountType === "buyer" ? selected?.buyerCompletedAt : selected?.sellerCompletedAt;
  const myReview = accountType === "buyer" ? selected?.buyerReview : selected?.sellerReview;

  return (
    <DashboardLayout role={layoutRole} title="Order Centre" description="After a deal is confirmed, buyer and seller contact each other directly. BidMyLot does not process payment or delivery.">
      {error && <ErrorState message={error} onRetry={load}/>} 
      {notice && <div className="mb-5 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18}/>{notice}</div>}
      <div className="mb-5 flex justify-end"><button type="button" disabled={busy} onClick={load} className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-xs font-bold"><RefreshCw size={14}/>Refresh</button></div>
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <DashboardSection title={`Confirmed Deals (${orders.length})`} description="Select a deal to view contact details.">
          <div className="space-y-2">
            {!orders.length && <p className="text-sm text-slate-500">No confirmed deals yet.</p>}
            {orders.map((order) => <button key={order.id} type="button" onClick={() => selectOrder(order)} className={`w-full rounded-xl border p-3 text-left ${selected?.id === order.id ? "border-blue-600 bg-blue-50" : "bg-white"}`}>
              <div className="flex justify-between gap-2"><span className="font-mono text-[10px] text-slate-500">{order.orderReference}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase">{order.orderStatus}</span></div>
              <p className="mt-2 truncate text-sm font-bold text-slate-900">{order.listingDetails?.title || "Confirmed lot"}</p>
              <p className="mt-1 text-xs font-bold text-blue-700">{formatCurrency(order.totalAmount, order.currency)}</p>
            </button>)}
          </div>
        </DashboardSection>
        <DashboardSection title={selected?.orderReference || "Deal Details"} description={selected ? `Confirmed ${formatDateTime(selected.createdAt)}` : "Select a deal."}>
          {selected && <div className="space-y-5">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <h3 className="font-black text-slate-900">Direct contact is active</h3>
              <p className="mt-1 text-sm text-slate-600">The accepted amount is recorded below. Buyer and seller arrange all remaining steps privately. Never share passwords or OTP codes.</p>
              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <div><dt className="text-[10px] font-bold uppercase text-slate-500">Quantity</dt><dd className="font-bold">{selected.quantity}</dd></div>
                <div><dt className="text-[10px] font-bold uppercase text-slate-500">Unit value</dt><dd className="font-bold">{formatCurrency(selected.unitPrice, selected.currency)}</dd></div>
                <div><dt className="text-[10px] font-bold uppercase text-slate-500">Agreed value</dt><dd className="font-black">{formatCurrency(selected.totalAmount, selected.currency)}</dd></div>
              </dl>
            </div>
            {accountType === "buyer" && <ContactCard title="Seller contact" details={selected.sellerDetails} accent="border-blue-200 bg-blue-50/50" orderReference={selected.orderReference}/>} 
            {accountType === "seller" && <ContactCard title="Buyer contact" details={selected.buyerDetails} accent="border-emerald-200 bg-emerald-50/50" orderReference={selected.orderReference}/>} 
            {layoutRole === "admin" && <div className="grid gap-4 lg:grid-cols-2"><ContactCard title="Buyer contact" details={selected.buyerDetails} accent="border-emerald-200 bg-emerald-50/50" orderReference={selected.orderReference}/><ContactCard title="Seller contact" details={selected.sellerDetails} accent="border-blue-200 bg-blue-50/50" orderReference={selected.orderReference}/></div>}
            <div className="rounded-xl border bg-slate-50 p-4 text-xs text-slate-700">
              <p><strong>Buyer completion:</strong> {selected.buyerCompletedAt ? formatDateTime(selected.buyerCompletedAt) : "Awaiting confirmation"}</p>
              <p className="mt-1"><strong>Seller completion:</strong> {selected.sellerCompletedAt ? formatDateTime(selected.sellerCompletedAt) : "Awaiting confirmation"}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {isParty && selected.orderStatus === "confirmed" && !myCompletion && <button type="button" disabled={busy} onClick={confirmComplete} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white"><Check size={15}/>Confirm my side is complete</button>}
              {isParty && selected.orderStatus === "confirmed" && <button type="button" disabled={busy} onClick={cancel} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold"><XCircle size={15}/>Cancel deal</button>}
              {isParty && activeStatuses.has(selected.orderStatus) && <button type="button" disabled={busy} onClick={dispute} className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-bold"><AlertTriangle size={15}/>Open dispute</button>}
              {isParty && selected.orderStatus === "completed" && !myReview && <button type="button" disabled={busy} onClick={review} className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white"><Star size={15}/>Leave review</button>}
              {myReview && <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800"><CheckCircle2 size={15}/>Review submitted</span>}
            </div>
          </div>}
        </DashboardSection>
      </div>
    </DashboardLayout>
  );
}
