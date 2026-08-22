import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, BadgeCheck, Check, ChevronDown, CircleHelp,
  ClipboardCheck, ContactRound, FileCheck2, Handshake, LockKeyhole,
  MessageSquareText, PackageCheck, PackagePlus, Search, ShieldCheck,
  ShoppingBag, Star, Store, UserCheck, UserRound,
} from "lucide-react";
import { Navbar, Footer, Link, Image } from "../components";
import api from "../lib/api";

const BUYER_STEPS = [
  {
    title: "Create a buyer account",
    summary: "Buyer and seller access stay separate.",
    description: "Register through the buyer journey to keep your profile, offers, orders and reviews separate from seller activity.",
    icon: UserRound,
    points: ["Use the dedicated buyer registration and login", "Manage buyer information from the buyer dashboard", "A seller account does not grant buyer access"],
    actions: [["Create Buyer Account", "/buyer/register"], ["Buyer Login", "/buyer/login"]],
  },
  {
    title: "Complete your profile and verification",
    summary: "Verification is required before participating.",
    description: "Add the required buyer details and submit verification information. Your documents remain private and are not shown on public listings.",
    icon: UserCheck,
    points: ["Complete the required buyer profile fields", "Submit the requested verification information", "Wait for verification before making offers"],
    note: "Never share passwords or OTP codes with a seller or another user.",
  },
  {
    title: "Browse approved listings",
    summary: "Only reviewed listings appear publicly.",
    description: "Explore categories and subcategories, then review the description, condition, images, quantity, location and offer terms.",
    icon: Search,
    points: ["Open negotiated-price or multi-unit listings", "Review the available quantity and unit price", "Check listing details before making an offer"],
    actions: [["Browse Listings", "/auctions"]],
  },
  {
    title: "Send a private offer",
    summary: "Your offer is not a public bid ladder.",
    description: "For a negotiated listing, propose a price. For a multi-unit listing, choose a quantity and unit price; the total is quantity multiplied by unit price.",
    icon: MessageSquareText,
    points: ["Offer below, at or above the seller's asking price", "Enter both quantity and unit price for multi-unit lots", "Only authorized participants can view the negotiation"],
    note: "BidMyLot uses private offers and counteroffers—not a public highest-bid auction ladder.",
  },
  {
    title: "Review the seller's response",
    summary: "Accept a counteroffer or confirm an allocation.",
    description: "The seller may shortlist, counter, reject or select an offer. If selected, confirm the agreed price and quantity before the stated deadline.",
    icon: Handshake,
    points: ["Review any counteroffer carefully", "Confirm only the price and quantity you accept", "An expired or rejected offer cannot create a deal"],
  },
  {
    title: "Connect directly after confirmation",
    summary: "Contact details unlock for the confirmed parties.",
    description: "After buyer confirmation, a direct-deal order is recorded and buyer and seller contact cards become available to the confirmed parties.",
    icon: ContactRound,
    points: ["Coordinate payment directly with the seller", "Arrange collection, shipping or delivery privately", "Keep a record of the final arrangement"],
    note: "BidMyLot does not process payments, escrow, delivery, shipping, collection, tracking or payouts.",
  },
  {
    title: "Confirm completion and review",
    summary: "Both parties close the deal independently.",
    description: "Buyer and seller each confirm completion from their own account. If there is a problem, use the dispute flow and preserve supporting records.",
    icon: Star,
    points: ["Your confirmation does not confirm for the other party", "Open a dispute if the direct arrangement breaks down", "Leave a review only after both sides confirm completion"],
    actions: [["Open Buyer Dashboard", "/buyer/dashboard"]],
  },
];

const SELLER_STEPS = [
  {
    title: "Create a seller account",
    summary: "Choose the seller type that fits you.",
    description: "Register through the seller journey as an individual, business or distributor. Seller access remains separate from buyer access.",
    icon: Store,
    points: ["Choose individual, business or distributor", "Use the dedicated seller registration and login", "Manage selling activity from the seller dashboard"],
    actions: [["Create Seller Account", "/seller/register"], ["Seller Login", "/seller/login"]],
  },
  {
    title: "Complete seller verification",
    summary: "Verify before listing or negotiating.",
    description: "Complete the profile and verification requirements for your seller type before participating in the marketplace.",
    icon: BadgeCheck,
    points: ["Provide accurate personal or organization details", "Submit the required verification information", "Keep verification documents private and current"],
  },
  {
    title: "Create the listing",
    summary: "Choose negotiated or multi-unit selling.",
    description: "Add accurate product details, category, condition, images and location. Choose private price negotiation or a multi-unit quantity and unit-price model.",
    icon: PackagePlus,
    points: ["Describe the item and condition accurately", "Upload clear and relevant images", "Set asking price, quantity and unit-price information"],
    actions: [["Start a Listing", "/seller/dashboard"]],
  },
  {
    title: "Submit for platform review",
    summary: "A seller cannot publish their own listing.",
    description: "An admin or authorized employee reviews the submission and can approve, reject or request changes. The listing stays private until approved.",
    icon: ClipboardCheck,
    points: ["Save work as a private draft", "Submit the completed listing for review", "Respond to requested changes and resubmit"],
    note: "Submission does not make a listing public. Only an authorized approval can publish it.",
  },
  {
    title: "Manage private offers",
    summary: "Shortlist, counter, reject or select.",
    description: "Review offers from eligible buyers without exposing them publicly. For multi-unit listings, allocate only available inventory.",
    icon: MessageSquareText,
    points: ["Counter with a revised price or quantity", "Reject unsuitable offers or select an agreement", "Never allocate more units than remain available"],
  },
  {
    title: "Connect after buyer confirmation",
    summary: "The confirmed deal unlocks direct contact.",
    description: "Once the buyer confirms the selected offer or allocation, the order records the agreement and both parties can access the contact cards.",
    icon: ContactRound,
    points: ["Agree payment directly with the buyer", "Arrange handover, collection or shipping privately", "Do not ask for passwords or OTP codes"],
    note: "BidMyLot records the agreement but does not handle payment, escrow, delivery, tracking or seller payout.",
  },
  {
    title: "Confirm completion and receive feedback",
    summary: "Close the direct deal from your account.",
    description: "Confirm completion only after the private arrangement is finished. Both parties must confirm before the completed review stage becomes available.",
    icon: PackageCheck,
    points: ["Buyer and seller confirmations are independent", "Use disputes for unresolved deal problems", "Reviews follow successful two-sided completion"],
    actions: [["Open Seller Dashboard", "/seller/dashboard"]],
  },
];

const FAQS = {
  buyer: [
    ["Are offers public?", "No. Offers and counteroffers are private to the authorized participants and are not displayed as a public highest-bid ladder."],
    ["Can I offer a different price?", "Yes. A negotiated offer can be below, at or above the asking price. For multi-unit listings, specify both quantity and unit price."],
    ["When can I contact the seller?", "Contact cards are revealed only after the seller selects the offer or allocation and the buyer confirms it."],
    ["Does BidMyLot collect my payment?", "No. The buyer and seller agree and complete payment directly. BidMyLot does not provide payment processing or escrow."],
    ["Who arranges delivery or collection?", "The confirmed buyer and seller arrange collection, shipping or delivery directly. The platform does not provide or track these services."],
    ["When can I leave a review?", "The review stage becomes available after both the buyer and seller independently confirm that the deal is complete."],
  ],
  seller: [
    ["Which seller types are supported?", "You can register as an individual, business or distributor. Complete the profile and verification requirements for the selected type."],
    ["Can I publish a listing myself?", "No. An admin or authorized employee must approve the listing before it becomes public."],
    ["How can I respond to an offer?", "You can shortlist, counter, reject or select an offer, subject to the listing status and available inventory."],
    ["How are multi-unit totals calculated?", "The deal total is the confirmed quantity multiplied by the confirmed unit price. Allocations must not exceed available inventory."],
    ["Does BidMyLot deliver the item or pay me?", "No. You arrange handover and payment directly with the confirmed buyer. BidMyLot does not provide delivery, escrow or payouts."],
    ["What if the buyer and I cannot complete the deal?", "Use the dispute process, describe the issue clearly and retain records of the arrangement and communication."],
  ],
};

function Hero() {
  const [bannerImage, setBannerImage] = useState(() => localStorage.getItem("how_it_works_banner") || "/hero-auction-marketplace.png");
  useEffect(() => {
    api.get("/settings/how-it-works-banner").then(({ data }) => {
      if (data?.bannerUrl) {
        setBannerImage(data.bannerUrl);
        localStorage.setItem("how_it_works_banner", data.bannerUrl);
      }
    }).catch(() => {});
  }, []);
  return (
    <section className="border-b border-slate-200 bg-[#f8fafc] px-5 py-12 sm:px-[5vw] sm:py-20">
      <div className="mx-auto grid max-w-[1320px] items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <nav aria-label="Breadcrumb" className="mb-8 flex gap-2 text-xs text-slate-500"><Link href="/" className="hover:text-[#2563eb]">Home</Link><span>/</span><span className="text-[#0f172a]">How It Works</span></nav>
          <span className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.15em] text-[#2563eb]"><ShieldCheck size={17} /> Verified people. Private offers. Direct deals.</span>
          <h1 className="mt-5 text-[42px] font-bold leading-[1.04] tracking-[-.055em] text-[#0f172a] sm:text-6xl lg:text-[68px]">A clear way to agree on every lot.</h1>
          <p className="mt-6 max-w-2xl text-[15px] leading-7 text-slate-600 sm:text-[17px]">BidMyLot helps verified buyers and sellers discover approved listings, negotiate privately and confirm an agreement. After confirmation, both sides connect and complete the deal directly.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="/auctions" className="inline-flex min-h-12 items-center gap-2 rounded bg-[#2563eb] px-5 text-sm font-bold text-white hover:bg-[#1d4ed8]">Browse Listings <ArrowRight size={17} /></Link><Link href="/seller/register" className="inline-flex min-h-12 items-center rounded border border-slate-300 bg-white px-5 text-sm font-bold hover:border-[#2563eb] hover:text-[#2563eb]">Become a Seller</Link></div>
        </div>
        <div className="relative min-h-[390px] overflow-hidden rounded bg-[#0f172a] shadow-[0_28px_65px_rgba(15,23,42,.18)] sm:min-h-[470px]">
          <Image src={bannerImage} alt="Products offered through BidMyLot" fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/90 via-[#0f172a]/10 to-transparent" />
          <div className="absolute inset-x-5 bottom-5 rounded border border-white/20 bg-white/95 p-5 sm:inset-x-8 sm:bottom-8"><div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500"><span className="flex items-center gap-2 text-emerald-600"><BadgeCheck size={15} /> Approval first</span><span>No platform payment</span></div><div className="mt-4 grid grid-cols-3 gap-3">{["Verify", "Agree", "Connect"].map((label, index) => <div key={label} className="border-t border-slate-300 pt-3"><span className="text-[10px] text-[#2563eb]">0{index + 1}</span><p className="mt-1 text-xs font-bold">{label}</p></div>)}</div></div>
        </div>
      </div>
    </section>
  );
}

function RoleToggle({ role, onChange }) {
  const buyerRef = useRef(null);
  const sellerRef = useRef(null);
  const select = (next) => { onChange(next); (next === "buyer" ? buyerRef : sellerRef).current?.focus(); };
  return (
    <div role="tablist" aria-label="Choose buyer or seller workflow" className="relative grid w-full max-w-[480px] grid-cols-2 rounded-md border border-slate-300 bg-white p-1.5 shadow-sm">
      <span aria-hidden="true" className={`absolute bottom-1.5 top-1.5 w-[calc(50%-6px)] rounded bg-[#0f172a] transition-transform ${role === "seller" ? "translate-x-full" : "translate-x-0"}`} />
      {[["buyer", ShoppingBag, buyerRef], ["seller", Store, sellerRef]].map(([value, Icon, ref]) => (
        <button key={value} ref={ref} id={`${value}-workflow-tab`} type="button" role="tab" aria-selected={role === value} aria-controls="workflow-panel" tabIndex={role === value ? 0 : -1} onClick={() => select(value)} onKeyDown={(event) => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); select(role === "buyer" ? "seller" : "buyer"); } }} className={`relative z-10 inline-flex min-h-12 items-center justify-center gap-2 rounded px-3 text-sm font-bold ${role === value ? "text-white" : "text-[#0f172a]"}`}><Icon size={18} /> For {value === "buyer" ? "Buyers" : "Sellers"}</button>
      ))}
    </div>
  );
}

function DealPreview({ role, step }) {
  return (
    <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-[0_20px_45px_rgba(15,23,42,.10)]">
      <div className="flex h-10 items-center justify-between border-b border-slate-200 bg-slate-50 px-4 text-[9px] font-bold uppercase tracking-wider text-slate-500"><span className="flex gap-1.5"><i className="size-2 rounded-full bg-blue-400" /><i className="size-2 rounded-full bg-amber-400" /><i className="size-2 rounded-full bg-emerald-500" /></span><span>{role} journey</span></div>
      <div className="p-6"><span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-[#2563eb]"><LockKeyhole size={13} /> Private workflow</span><h4 className="mt-5 text-lg font-bold">{step.title}</h4><p className="mt-2 text-xs leading-5 text-slate-500">{step.summary}</p><div className="mt-6 space-y-3">{["Verified account", "Protected role access", "Recorded status"].map((item, index) => <div key={item} className="flex items-center gap-3 border-b border-slate-100 pb-3 text-xs text-slate-600"><span className={`grid size-7 place-items-center rounded-full ${index === 2 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>{index === 2 ? <FileCheck2 size={14} /> : <Check size={14} />}</span>{item}</div>)}</div></div>
    </div>
  );
}

function Workflow({ role }) {
  const steps = role === "buyer" ? BUYER_STEPS : SELLER_STEPS;
  const [activeIndex, setActiveIndex] = useState(0);
  const step = steps[activeIndex];
  const Icon = step.icon;
  const progress = ((activeIndex + 1) / steps.length) * 100;
  return (
    <div id="workflow-panel" role="tabpanel" aria-labelledby={`${role}-workflow-tab`} className="mt-12">
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-200 pb-7 md:flex-row md:items-end"><div><span className="text-[10px] font-extrabold uppercase tracking-[.15em] text-[#2563eb]">{role} journey</span><h2 className="mt-3 text-3xl font-bold tracking-[-.04em] sm:text-4xl">{role === "buyer" ? "From verification to a direct deal" : "From seller verification to completion"}</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Select each step to see what happens, who can act and when direct contact becomes available.</p></div><span className="shrink-0 text-xs font-bold text-slate-500">Step {activeIndex + 1} of {steps.length}</span></div>
      <div className="grid gap-7 lg:grid-cols-[.78fr_1.22fr] lg:gap-10">
        <div className="overflow-x-auto pb-2 lg:overflow-visible"><div className="flex min-w-max gap-2 lg:block lg:min-w-0">{steps.map((item, index) => { const StepIcon = item.icon; const selected = activeIndex === index; return <button key={item.title} type="button" aria-current={selected ? "step" : undefined} onClick={() => setActiveIndex(index)} className={`flex w-[240px] shrink-0 items-start gap-3 rounded border p-4 text-left lg:mb-2 lg:w-full ${selected ? "border-[#0f172a] bg-[#0f172a] text-white shadow-lg" : "border-slate-200 bg-white hover:border-slate-400"}`}><span className={`grid size-10 shrink-0 place-items-center rounded-full border ${selected ? "border-white/25 bg-white/10" : "border-slate-200 bg-blue-50 text-[#2563eb]"}`}><StepIcon size={18} /></span><span><span className={`text-[9px] font-extrabold uppercase tracking-wider ${selected ? "text-white/60" : "text-slate-400"}`}>Step {index + 1}</span><strong className="mt-1 block text-[13px] leading-5">{item.title}</strong><small className={`mt-1 block text-[10px] leading-4 ${selected ? "text-white/65" : "text-slate-500"}`}>{item.summary}</small></span></button>; })}</div></div>
        <article className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,.08)]">
          <div className="h-1 bg-slate-100"><div className="h-full bg-[#2563eb] transition-[width]" style={{ width: `${progress}%` }} /></div>
          <div className="grid gap-8 p-6 sm:p-8 xl:grid-cols-[1fr_.9fr] xl:p-10"><div><span className="grid size-12 place-items-center rounded-full bg-blue-50 text-[#2563eb]"><Icon size={22} /></span><p className="mt-6 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#2563eb]">What happens here?</p><h3 className="mt-2 text-2xl font-bold tracking-[-.035em]">{step.title}</h3><p className="mt-4 text-sm leading-6 text-slate-600">{step.description}</p><ul className="mt-6 space-y-3">{step.points.map((point) => <li key={point} className="flex items-start gap-3 text-xs leading-5 text-slate-700"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Check size={12} strokeWidth={3} /></span>{point}</li>)}</ul>{step.note && <div className="mt-6 flex items-start gap-3 border-l-2 border-amber-500 bg-amber-50 p-4 text-[11px] leading-5 text-amber-900"><CircleHelp size={17} className="mt-0.5 shrink-0" />{step.note}</div>}{step.actions && <div className="mt-7 flex flex-wrap gap-2">{step.actions.map(([label, href], index) => <Link key={label} href={href} className={`inline-flex min-h-11 items-center gap-2 rounded px-4 text-xs font-bold ${index === 0 ? "bg-[#2563eb] text-white hover:bg-[#1d4ed8]" : "border border-slate-300 hover:border-[#0f172a]"}`}>{label}{index === 0 && <ArrowRight size={15} />}</Link>)}</div>}</div><div className="self-center"><DealPreview role={role} step={step} /></div></div>
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-4"><button type="button" disabled={activeIndex === 0} onClick={() => setActiveIndex((value) => Math.max(0, value - 1))} className="inline-flex min-h-10 items-center gap-2 rounded px-3 text-xs font-bold disabled:opacity-35"><ArrowLeft size={15} /> Previous</button><span className="hidden text-[10px] font-semibold text-slate-500 sm:block">{Math.round(progress)}% complete</span><button type="button" disabled={activeIndex === steps.length - 1} onClick={() => setActiveIndex((value) => Math.min(steps.length - 1, value + 1))} className="inline-flex min-h-10 items-center gap-2 rounded px-3 text-xs font-bold disabled:opacity-35">Next step <ArrowRight size={15} /></button></div>
        </article>
      </div>
    </div>
  );
}

function DealModel() {
  const items = [[LockKeyhole, "Private negotiation", "Offers and counteroffers are visible only to authorized participants."], [Handshake, "Confirmed agreement", "The buyer confirms the selected price and quantity before the deadline."], [ContactRound, "Direct contact", "Contact cards unlock for the confirmed buyer and seller."], [PackageCheck, "Two-sided completion", "Each side confirms completion independently before reviews."]];
  return <section className="border-y border-slate-200 bg-[#0f172a] px-5 py-16 text-white sm:px-[5vw] sm:py-20"><div className="mx-auto max-w-[1120px]"><span className="text-[10px] font-extrabold uppercase tracking-[.15em] text-blue-400">The confirmed-deal model</span><h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-[-.04em] sm:text-4xl">The platform records the agreement. The parties complete it directly.</h2><div className="mt-10 grid gap-px overflow-hidden rounded border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">{items.map(([Icon, title, text], index) => <article key={title} className="bg-[#0f172a] p-6"><span className="text-[10px] font-bold text-blue-400">0{index + 1}</span><Icon className="mt-5 text-blue-400" size={24} /><h3 className="mt-4 text-sm font-bold">{title}</h3><p className="mt-2 text-xs leading-5 text-slate-400">{text}</p></article>)}</div><p className="mt-7 rounded border border-amber-400/30 bg-amber-400/10 p-4 text-xs leading-6 text-amber-100"><strong>Important:</strong> BidMyLot does not collect money, hold escrow, arrange delivery, provide shipping or collection, track goods, or issue seller payouts.</p></div></section>;
}

function Comparison() {
  const rows = [["Account", "Dedicated buyer account", "Dedicated seller account"], ["Verification", "Required before offers", "Required before listing and negotiation"], ["Main action", "Send or confirm a private offer", "Create listings and manage private offers"], ["Approval", "Browse approved public listings", "Admin or authorized employee publishes"], ["After agreement", "Coordinate directly with seller", "Coordinate directly with buyer"], ["Completion", "Confirm from buyer account", "Confirm from seller account"]];
  return <section className="bg-white px-5 py-16 sm:px-[5vw] sm:py-20"><div className="mx-auto max-w-[1120px]"><span className="text-[10px] font-extrabold uppercase tracking-[.15em] text-[#2563eb]">At a glance</span><h2 className="mt-3 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Separate roles, one clear agreement flow.</h2><div className="mt-9 overflow-x-auto rounded border border-slate-200"><table className="w-full min-w-[680px] border-collapse text-left"><thead className="bg-[#0f172a] text-white"><tr><th className="p-4 text-sm">Detail</th><th className="p-4 text-sm">Buyer</th><th className="p-4 text-sm">Seller</th></tr></thead><tbody>{rows.map(([detail, buyer, seller]) => <tr key={detail} className="border-t border-slate-200"><th className="bg-slate-50 p-4 text-xs">{detail}</th><td className="p-4 text-xs text-slate-600">{buyer}</td><td className="p-4 text-xs text-slate-600">{seller}</td></tr>)}</tbody></table></div></div></section>;
}

function Safety() {
  const cards = [[UserCheck, "Confirm identities", "Use only the contact information shown for the confirmed deal."], [LockKeyhole, "Protect access", "Never share passwords, OTP codes or private verification documents."], [FileCheck2, "Keep records", "Retain the agreed price, quantity and direct arrangement details."], [CircleHelp, "Use disputes", "If the deal breaks down, report the issue and preserve supporting evidence."]];
  return <section className="bg-blue-50/50 px-5 py-16 sm:px-[5vw] sm:py-20"><div className="mx-auto max-w-[1120px]"><span className="text-[10px] font-extrabold uppercase tracking-[.15em] text-[#2563eb]">Deal safely</span><h2 className="mt-3 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Before you exchange money or goods.</h2><div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([Icon, title, text]) => <article key={title} className="rounded border border-slate-200 bg-white p-5"><Icon size={22} className="text-[#2563eb]" /><h3 className="mt-4 text-sm font-bold">{title}</h3><p className="mt-2 text-xs leading-5 text-slate-600">{text}</p></article>)}</div></div></section>;
}

function FAQ({ role }) {
  const [openIndex, setOpenIndex] = useState(0);
  return <section className="bg-white px-5 py-16 sm:px-[5vw] sm:py-24"><div className="mx-auto grid max-w-[1120px] gap-10 lg:grid-cols-[.75fr_1.25fr] lg:gap-20"><div><span className="text-[10px] font-extrabold uppercase tracking-[.15em] text-[#2563eb]">{role} questions</span><h2 className="mt-3 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Answers for the current marketplace flow.</h2><p className="mt-4 text-sm leading-6 text-slate-600">Understand private offers, confirmation, direct contact and completion before you participate.</p></div><div className="border-t border-slate-200">{FAQS[role].map(([question, answer], index) => { const open = openIndex === index; const id = `${role}-faq-${index}`; return <article key={question} className="border-b border-slate-200"><h3><button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpenIndex(open ? null : index)} className="flex min-h-[72px] w-full items-center justify-between gap-5 py-4 text-left text-sm font-bold hover:text-[#2563eb]"><span>{question}</span><ChevronDown size={19} className={`shrink-0 text-[#2563eb] transition-transform ${open ? "rotate-180" : ""}`} /></button></h3><div id={id} role="region" hidden={!open}><p className="pb-6 pr-8 text-xs leading-6 text-slate-600">{answer}</p></div></article>; })}</div></div></section>;
}

function FinalCTA({ role }) {
  const buyer = role === "buyer";
  return <section className="bg-[#0f172a] px-5 py-16 text-center text-white sm:px-[5vw] sm:py-24"><div className="mx-auto max-w-3xl"><span className="text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-400">Your next step</span><h2 className="mt-4 text-3xl font-bold tracking-[-.045em] sm:text-5xl">{buyer ? "Find an approved listing and make a private offer." : "Create an accurate listing and submit it for review."}</h2><p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-300">{buyer ? "Complete buyer verification, review the listing and agree only to terms you understand." : "Choose your seller type, complete verification and let the review team approve the listing before it goes public."}</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Link href={buyer ? "/auctions" : "/seller/register"} className="inline-flex min-h-12 items-center gap-2 rounded bg-[#2563eb] px-5 text-sm font-bold text-white hover:bg-[#1d4ed8]">{buyer ? "Browse Listings" : "Register as Seller"}<ArrowRight size={16} /></Link><Link href={buyer ? "/buyer/register" : "/seller/dashboard"} className="inline-flex min-h-12 items-center rounded border border-white/40 px-5 text-sm font-bold text-white hover:bg-white/10">{buyer ? "Register as Buyer" : "Open Seller Dashboard"}</Link></div></div></section>;
}

function SupportPrompt() {
  return <section className="border-b border-slate-200 bg-[#f8fafc] px-5 py-12 sm:px-[5vw]"><div className="mx-auto flex max-w-[1120px] flex-col items-start justify-between gap-6 rounded border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:p-8"><div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-blue-50 text-[#2563eb]"><CircleHelp size={21} /></span><div><h2 className="text-xl font-bold">Still have questions?</h2><p className="mt-2 text-xs leading-5 text-slate-600">Visit Support for help with accounts, verification, listings, private offers, confirmed deals and disputes.</p></div></div><Link href="/support" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded border border-slate-300 px-4 text-xs font-bold hover:border-[#2563eb] hover:text-[#2563eb]">Visit Support <ArrowRight size={15} /></Link></div></section>;
}

export default function HowItWorksPage() {
  const [role, setRole] = useState("buyer");
  return (
    <main className="min-h-screen bg-white text-[#0f172a] selection:bg-[#2563eb] selection:text-white">
      <Navbar /><Hero />
      <section className="px-5 py-16 sm:px-[5vw] sm:py-24"><div className="mx-auto max-w-[1320px]"><div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end"><div><span className="text-[10px] font-extrabold uppercase tracking-[.15em] text-[#2563eb]">Choose your journey</span><h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-[-.045em] sm:text-5xl">See who acts at every stage.</h2></div><RoleToggle role={role} onChange={setRole} /></div><Workflow key={role} role={role} /></div></section>
      <DealModel /><Comparison /><Safety /><FAQ key={role} role={role} /><FinalCTA role={role} /><SupportPrompt /><Footer />
    </main>
  );
}
