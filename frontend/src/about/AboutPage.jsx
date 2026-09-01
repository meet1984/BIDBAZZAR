"use client";

import React, { useState, useEffect } from "react";
import {
  Aperture,
  ArrowRight,
  BadgeCheck,
  Camera,
  Car,
  ChevronDown,
  Clock3,
  Factory,
  Gem,
  Home,
  Laptop,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import { Navbar, Footer, Link, Image } from "../components";
import api from "../lib/api";
import { resolveImageUrl } from "../lib/image";

const challenges = [
  {
    number: "01",
    title: "Unclear listing information",
    copy: "Buyers need product details, images, condition, pricing and auction timing in one understandable place.",
    icon: Search,
  },
  {
    number: "02",
    title: "Difficult auction discovery",
    copy: "Public auctions should be simple to browse, search and filter without unnecessary friction.",
    icon: Aperture,
  },
  {
    number: "03",
    title: "Unstructured submissions",
    copy: "Sellers need a guided way to provide the information required to prepare an auction.",
    icon: UserRoundCheck,
  },
  {
    number: "04",
    title: "Limited status visibility",
    copy: "Sellers should understand whether a submission is in draft, review, approved, rejected or awaiting changes.",
    icon: Clock3,
  },
];

const approaches = [
  [
    "Clear information",
    "Auction details should help people understand the product, status, price and timeline before taking action.",
  ],
  [
    "Reviewed public listings",
    "Seller-created auctions go through admin review before they are eligible to appear publicly.",
  ],
  [
    "Separate buyer and seller journeys",
    "Each role receives focused workflows, dashboards and actions relevant to its needs.",
  ],
  [
    "Straightforward participation",
    "Browsing, submitting, reviewing and tracking auctions should feel organised and predictable.",
  ],
];

const audiences = {
  buyer: {
    eyebrow: "For buyers",
    heading: "Discover auctions with greater clarity.",
    copy: "Browse public listings, compare relevant details, understand auction timing and access your account when you are ready to participate.",
    points: [
      "Explore approved public auctions",
      "Review product and auction information",
      "Track bids, watchlists and results from the buyer dashboard",
    ],
    cta: "Browse Auctions",
    href: "/auctions",
  },
  seller: {
    eyebrow: "For sellers",
    heading: "Prepare and submit auctions through a structured process.",
    copy: "Create a product listing, choose an eligible schedule and submit the auction for admin review before publication.",
    points: [
      "Add product details and images",
      "Submit the listing for review",
      "Track review decisions and auction progress",
    ],
    cta: "Start Selling",
    href: "/seller/register",
  },
};

const reviewStages = [
  "Draft",
  "Submitted",
  "Under Review",
  "Approved",
  "Scheduled",
];

const principles = [
  [
    "Clarity before action",
    "People should be able to understand the available information before deciding what to do next.",
  ],
  [
    "Thoughtful review",
    "Public listings should follow a defined submission and review process.",
  ],
  [
    "Equal focus on both sides",
    "The marketplace should work clearly for buyers as well as sellers.",
  ],
  [
    "Useful technology",
    "Technology should simplify participation without adding unnecessary complexity.",
  ],
  [
    "Responsible growth",
    "New functionality should be introduced when it improves the marketplace—not simply because it is technically possible.",
  ],
];

const journey = [
  ["Seller", "Seller prepares a listing", "Private seller activity"],
  ["Review", "Listing is submitted for review", "Admin-review activity"],
  ["Schedule", "Approved auction is scheduled", "Admin-review activity"],
  [
    "Public",
    "Buyers discover the public auction",
    "Public marketplace activity",
  ],
  ["Bid", "Eligible buyers participate", "Buyer participation"],
  ["Result", "Both sides track the result", "Role-specific activity"],
];

const CATEGORY_ICON_MAP = {
  vehicles: Car,
  vehicle: Car,
  automotive: Car,
  car: Car,
  electronics: Laptop,
  tech: Laptop,
  computer: Laptop,
  collectibles: Camera,
  antique: Camera,
  antiques: Camera,
  "fashion-luxury": Gem,
  fashion: Gem,
  luxury: Gem,
  "industrial-equipment": Factory,
  industrial: Factory,
  equipment: Factory,
  "home-lifestyle": Home,
  home: Home,
  lifestyle: Home,
  "jewelry-watches": Gem,
  jewelry: Gem,
  watches: Gem,
  art: Sparkles,
  paintings: Sparkles,
  "real-estate": Home,
  property: Home,
};

function getCategoryIcon(slug, name) {
  const s = (slug || "").toLowerCase();
  const n = (name || "").toLowerCase();
  for (const [key, Icon] of Object.entries(CATEGORY_ICON_MAP)) {
    if (s.includes(key) || n.includes(key)) {
      return Icon;
    }
  }
  return Sparkles;
}

const faqs = [
  [
    "What is bidmylot?",
    "bidmylot is an online auction marketplace being built to connect buyers with public, admin-reviewed auction listings and give sellers a structured submission process.",
  ],
  [
    "Who can browse public auctions?",
    "Anyone can explore publicly available auctions. Draft, pending, rejected and otherwise unapproved listings are not shown publicly.",
  ],
  [
    "Do I need an account to place a bid?",
    "Yes. Browsing is public, but a buyer account is required before a person can place a bid.",
  ],
  [
    "How does a seller submit an auction?",
    "A seller creates an account, adds product details and images, proposes an eligible schedule, and submits the listing for admin review.",
  ],
  [
    "Why does an auction require admin review?",
    "Review helps confirm that a submission contains the marketplace information needed before it becomes eligible for public publication.",
  ],
  [
    "Does admin review guarantee a product?",
    "No. Admin review is a listing workflow and should not be interpreted as an unconditional guarantee of a product, seller or transaction.",
  ],
  [
    "When does an approved auction become public?",
    "An approved auction becomes eligible for publication according to its valid, approved auction schedule.",
  ],
  [
    "Where can buyers and sellers track activity?",
    "Buyers and sellers can follow relevant bids, submissions, review decisions and auction progress from their role-specific dashboards.",
  ],
];

function SectionTitle({ label, title, copy }) {
  return (
    <div className="bb-heading">
      <span className="bb-label">{label}</span>
      <h2>{title}</h2>
      {copy && <p>{copy}</p>}
    </div>
  );
}

function AudienceTabs() {
  const [active, setActive] = useState("buyer");
  const content = audiences[active];
  const tabs = ["buyer", "seller"];

  const handleKeys = (event, index) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const nextIndex =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : (index - 1 + tabs.length) % tabs.length;
    const next = tabs[nextIndex];
    setActive(next);
    document.getElementById(`bb-${next}-tab`)?.focus();
  };

  return (
    <section
      className="bb-section bb-audience"
      aria-labelledby="audience-title"
    >
      <div className="bb-audience-intro">
        <span className="bb-label">Two sides, one marketplace</span>
        <h2 id="audience-title">Designed around the role you play.</h2>
        <div
          className="bb-tabs"
          role="tablist"
          aria-label="Choose a marketplace perspective"
        >
          {tabs.map((tab, index) => (
            <button
              key={tab}
              id={`bb-${tab}-tab`}
              type="button"
              role="tab"
              aria-selected={active === tab}
              aria-controls="bb-audience-panel"
              tabIndex={active === tab ? 0 : -1}
              onClick={() => setActive(tab)}
              onKeyDown={(event) => handleKeys(event, index)}
            >
              For {tab === "buyer" ? "Buyers" : "Sellers"}
            </button>
          ))}
        </div>
      </div>
      <div
        id="bb-audience-panel"
        className="bb-audience-panel"
        role="tabpanel"
        aria-labelledby={`bb-${active}-tab`}
      >
        <span className="bb-panel-label">{content.eyebrow}</span>
        <h3>{content.heading}</h3>
        <p>{content.copy}</p>
        <ul>
          {content.points.map((point) => (
            <li key={point}>
              <BadgeCheck size={18} aria-hidden="true" />
              {point}
            </li>
          ))}
        </ul>
        <Link className="bb-button bb-button-light" href={content.href}>
          {content.cta}
          <ArrowRight size={17} />
        </Link>
      </div>
    </section>
  );
}

function FAQSection() {
  const [open, setOpen] = useState(0);

  return (
    <section className="bb-section bb-faq" aria-labelledby="faq-title">
      <div className="bb-faq-intro">
        <SectionTitle
          label="Questions, answered"
          title="A few things worth knowing."
          copy="Clear participation starts with knowing what the marketplace does—and what it does not claim to do."
        />
      </div>
      <div className="bb-faq-list">
        {faqs.map(([question, answer], index) => {
          const expanded = open === index;
          return (
            <article key={question}>
              <h3>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`bb-faq-answer-${index}`}
                  onClick={() => setOpen(expanded ? null : index)}
                >
                  <span>
                    <small>{String(index + 1).padStart(2, "0")}</small>
                    {question}
                  </span>
                  <ChevronDown size={20} aria-hidden="true" />
                </button>
              </h3>
              <div
                id={`bb-faq-answer-${index}`}
                className="bb-faq-answer"
                hidden={!expanded}
              >
                <p>{answer}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const DEFAULT_HERO_IMAGE = "/hero-auction-marketplace.png";

export default function AboutPage() {
  const [heroPhotos, setHeroPhotos] = useState(() => {
    try {
      const cached = localStorage.getItem("about_photos");
      return cached
        ? JSON.parse(cached)
        : {
          heroImage1: DEFAULT_HERO_IMAGE,
          heroImage2: DEFAULT_HERO_IMAGE,
          heroImage3: DEFAULT_HERO_IMAGE,
        };
    } catch {
      return {
        heroImage1: DEFAULT_HERO_IMAGE,
        heroImage2: DEFAULT_HERO_IMAGE,
        heroImage3: DEFAULT_HERO_IMAGE,
      };
    }
  });

  const [aboutCategories, setAboutCategories] = useState(() => {
    try {
      const cached = localStorage.getItem("about_categories");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    api
      .get("/settings/about-photos")
      .then(({ data }) => {
        if (data?.photos) {
          setHeroPhotos(data.photos);
          try {
            localStorage.setItem("about_photos", JSON.stringify(data.photos));
          } catch { }
        }
      })
      .catch(() => { });

    api
      .get("/settings/about-categories")
      .then(({ data }) => {
        if (data?.categories && Array.isArray(data.categories)) {
          setAboutCategories(data.categories);
          try {
            localStorage.setItem("about_categories", JSON.stringify(data.categories));
          } catch { }
        }
      })
      .catch(() => { });
  }, []);

  return (
    <>
      <style>{`
        .bb-about{--navy:#0f172a;--navy2:#1e293b;--blue:#2563eb;--blue2:#1d4ed8;--cream:#f8fafc;--paper:#ffffff;--ink:#0f172a;--slate:#64748b;--line:#e2e8f0;--green:#10b981;overflow:hidden;background:var(--paper);color:var(--ink)}
        .bb-about *{box-sizing:border-box}.bb-about a{text-decoration:none}.bb-about button,.bb-about a{-webkit-tap-highlight-color:transparent}.bb-about button:focus-visible,.bb-about a:focus-visible{outline:3px solid rgba(37,99,235,.28);outline-offset:4px}
        .bb-section{padding:clamp(78px,8vw,124px) clamp(18px,6vw,92px)}.bb-label,.bb-panel-label{display:inline-flex;align-items:center;gap:8px;color:var(--blue);font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.bb-label:before{content:"";width:22px;height:1px;background:currentColor}
        .bb-heading{max-width:790px}.bb-heading h2,.bb-audience h2{margin:14px 0 0;color:var(--navy);font-size:clamp(38px,4.4vw,64px);font-weight:720;letter-spacing:-.058em;line-height:1.04}.bb-heading>p{max-width:610px;margin:20px 0 0;color:var(--slate);font-size:15px;line-height:1.75}
        .bb-button{min-height:50px;padding:0 21px;display:inline-flex;align-items:center;justify-content:center;gap:9px;border:1px solid transparent;border-radius:4px;font-size:13px;font-weight:730;transition:background .2s,color .2s,border-color .2s,transform .2s}.bb-button:hover{transform:translateY(-2px)}.bb-button-primary{background:var(--blue);color:white}.bb-button-primary:hover{background:var(--blue2)}.bb-button-secondary{border-color:#cbd5e1;background:white;color:var(--navy)}.bb-button-secondary:hover{border-color:var(--navy)}.bb-button-light{background:white;color:var(--navy)}
        .bb-hero{min-height:720px;padding:clamp(58px,7vw,110px) clamp(18px,6vw,92px);display:grid;grid-template-columns:minmax(0,.93fr) minmax(440px,1.07fr);gap:clamp(40px,7vw,110px);align-items:center;background:linear-gradient(110deg,#ffffff 0 60%,#f8fafc 60%)}.bb-hero-copy{max-width:690px}.bb-hero h1{margin:22px 0 24px;color:var(--navy);font-size:clamp(48px,5.35vw,78px);font-weight:740;letter-spacing:-.067em;line-height:1.01}.bb-hero h1 em{color:var(--blue);font-style:normal;font-weight:470}.bb-hero-copy>p{max-width:620px;margin:0;color:#64748b;font-size:clamp(16px,1.35vw,19px);line-height:1.72}.bb-hero-actions{margin-top:31px;display:flex;flex-wrap:wrap;gap:10px}.bb-hero-note{margin-top:29px;padding-top:20px;display:flex;gap:11px;border-top:1px solid var(--line);color:var(--blue);font-size:12px;line-height:1.55}.bb-hero-note span{max-width:490px;color:var(--slate)}
        .bb-catalogue{min-height:560px;position:relative;display:grid;grid-template-columns:1.14fr .86fr;grid-template-rows:1fr 1fr;gap:10px}.bb-catalogue-card{position:relative;overflow:hidden;background:var(--navy);box-shadow:0 22px 55px rgba(15,23,42,.13)}.bb-catalogue-card:first-child{grid-row:1/3}.bb-catalogue-card img{object-fit:cover;object-position:center;filter:saturate(1) contrast(1.02);transition:transform .3s ease}.bb-catalogue-card:hover img{transform:scale(1.02)}.bb-catalogue-card:nth-child(2) img{object-fit:cover;object-position:center}.bb-catalogue-card:nth-child(3) img{object-fit:cover;object-position:center}.bb-catalogue-card:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,rgba(15,23,42,.72))}.bb-catalogue-tag{position:absolute;z-index:2;left:18px;right:18px;bottom:16px;display:flex;align-items:end;justify-content:space-between;gap:10px;color:white}.bb-catalogue-tag span{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:680}.bb-catalogue-tag small{color:#e2e8f0;font-size:9px;font-weight:600;letter-spacing:.1em;text-transform:uppercase}.bb-catalogue-mark{position:absolute;z-index:3;top:18px;left:18px;padding:8px 10px;background:rgba(255,255,255,.94);color:var(--blue);font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
        .bb-purpose{display:grid;grid-template-columns:.72fr 1.28fr;gap:clamp(50px,10vw,155px);align-items:start;background:white}.bb-purpose .bb-label{margin-top:10px}.bb-purpose-copy h2{max-width:870px;margin:0 0 34px;color:var(--navy);font-size:clamp(42px,5vw,72px);font-weight:690;letter-spacing:-.062em;line-height:1.05}.bb-purpose-copy p{max-width:810px;margin:0;color:var(--slate);font-size:16px;line-height:1.85}.bb-purpose-copy p+p{margin-top:23px;padding-left:28px;border-left:2px solid var(--blue);color:#334155}
        .bb-challenges{background:var(--cream)}.bb-challenge-grid{margin-top:54px;display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--line);border-left:1px solid var(--line)}.bb-challenge{min-height:305px;padding:28px;display:flex;flex-direction:column;border-right:1px solid var(--line);border-bottom:1px solid var(--line);background:rgba(255,255,255,.6);transition:background .2s,transform .2s}.bb-challenge:hover{background:white;transform:translateY(-3px)}.bb-challenge-top{display:flex;align-items:center;justify-content:space-between;color:var(--blue)}.bb-challenge-top small{color:#94a3b8;font-family:monospace;font-size:11px;font-weight:700}.bb-challenge h3{margin:auto 0 12px;color:var(--navy);font-size:18px;letter-spacing:-.025em}.bb-challenge p{margin:0;color:var(--slate);font-size:12px;line-height:1.7}
        .bb-approach{background:var(--navy);color:white}.bb-approach .bb-label{color:#60a5fa}.bb-approach .bb-heading h2{color:white}.bb-approach .bb-heading>p{color:#94a3b8}.bb-approach-grid{margin-top:55px;display:grid;grid-template-columns:repeat(2,1fr);border-top:1px solid #334155;border-left:1px solid #334155}.bb-approach-card{min-height:220px;padding:34px;display:grid;grid-template-columns:50px 1fr;gap:22px;border-right:1px solid #334155;border-bottom:1px solid #334155}.bb-approach-card>span{width:42px;height:42px;display:grid;place-items:center;border:1px solid #475569;border-radius:50%;color:#60a5fa;font-family:monospace;font-size:11px;font-weight:700}.bb-approach-card h3{margin:4px 0 10px;font-size:18px}.bb-approach-card p{max-width:520px;margin:0;color:#cbd5e1;font-size:12px;line-height:1.75}
        .bb-audience{display:grid;grid-template-columns:.82fr 1.18fr;gap:clamp(50px,9vw,140px);align-items:center;background:white}.bb-audience-intro{max-width:620px}.bb-tabs{margin-top:34px;padding:5px;display:inline-flex;border:1px solid var(--line);background:var(--cream)}.bb-tabs button{min-height:44px;padding:0 22px;border:0;background:transparent;color:var(--slate);cursor:pointer;font-size:12px;font-weight:730}.bb-tabs button[aria-selected=true]{background:var(--blue);color:white}.bb-audience-panel{min-height:500px;padding:clamp(38px,5vw,70px);display:flex;flex-direction:column;justify-content:center;background:var(--blue);color:white;box-shadow:0 28px 60px rgba(37,99,235,.16)}.bb-panel-label{color:#bfdbfe}.bb-audience-panel h3{max-width:650px;margin:15px 0 18px;font-size:clamp(32px,3.8vw,54px);font-weight:670;letter-spacing:-.055em;line-height:1.08}.bb-audience-panel>p{max-width:610px;margin:0;color:#dbeafe;font-size:14px;line-height:1.75}.bb-audience-panel ul{margin:28px 0 31px;padding:22px 0;display:grid;gap:15px;border-top:1px solid rgba(255,255,255,.26);border-bottom:1px solid rgba(255,255,255,.26);list-style:none}.bb-audience-panel li{display:flex;align-items:center;gap:11px;color:#eff6ff;font-size:12px}.bb-audience-panel .bb-button{align-self:flex-start}
        .bb-review{background:var(--paper)}.bb-review-layout{margin-top:55px;display:grid;grid-template-columns:1.42fr .58fr;gap:35px}.bb-stage-line{padding:36px;display:grid;grid-template-columns:repeat(5,1fr);background:white;border:1px solid var(--line)}.bb-stage{position:relative;text-align:center}.bb-stage:not(:last-child):after{content:"";position:absolute;top:18px;left:58%;width:84%;height:1px;background:#cbd5e1}.bb-stage span{width:37px;height:37px;margin:0 auto 14px;position:relative;z-index:1;display:grid;place-items:center;border:1px solid #cbd5e1;border-radius:50%;background:white;color:var(--blue);font-family:monospace;font-size:11px;font-weight:700}.bb-stage:nth-child(4) span,.bb-stage:nth-child(5) span{border-color:var(--green);background:#ecfdf5;color:var(--green)}.bb-stage b{display:block;color:var(--navy);font-size:11px}.bb-review-outcomes{padding:34px;background:var(--cream);border:1px solid var(--line)}.bb-review-outcomes>small{display:block;margin-bottom:19px;color:#64748b;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.bb-outcome{padding:16px 0;display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--line);color:var(--navy);font-size:12px;font-weight:720}.bb-outcome span{width:9px;height:9px;border-radius:50%;background:#3b82f6}.bb-outcome:last-child span{background:#f43f5e}.bb-review-points{margin:35px 0 0;padding:0;display:grid;grid-template-columns:repeat(2,1fr);gap:13px 40px;list-style:none}.bb-review-points li{display:flex;gap:11px;color:var(--slate);font-size:12px;line-height:1.65}.bb-review-points li:before{content:"";width:6px;height:6px;margin-top:7px;flex:none;border-radius:50%;background:var(--blue)}.bb-clarification{margin-top:32px;padding:22px 24px;border-left:3px solid var(--blue);background:#eff6ff;color:#1e40af;font-size:12px;line-height:1.75}
        .bb-principles{background:white}.bb-principle-list{margin-top:52px;border-top:1px solid var(--line)}.bb-principle{min-height:145px;padding:27px 0;display:grid;grid-template-columns:80px .7fr 1.3fr;gap:35px;align-items:center;border-bottom:1px solid var(--line)}.bb-principle>span{color:var(--blue);font-family:monospace;font-size:11px;font-weight:700}.bb-principle h3{margin:0;color:var(--navy);font-size:21px;letter-spacing:-.025em}.bb-principle p{max-width:680px;margin:0;color:var(--slate);font-size:13px;line-height:1.7}
        .bb-journey{background:var(--cream)}.bb-journey-track{margin-top:55px;display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line)}.bb-journey-step{min-height:190px;padding:28px;position:relative;background:white}.bb-journey-step>span{display:inline-flex;padding:7px 9px;background:#eff6ff;color:var(--blue);font-size:8px;font-weight:800;letter-spacing:.11em;text-transform:uppercase}.bb-journey-step:nth-child(2),.bb-journey-step:nth-child(3){background:#f8fafc}.bb-journey-step:nth-child(4){background:white}.bb-journey-step:nth-child(5),.bb-journey-step:nth-child(6){background:#f8fafc}.bb-journey-step h3{margin:24px 0 8px;color:var(--navy);font-size:17px;letter-spacing:-.025em}.bb-journey-step p{margin:0;color:var(--slate);font-size:12px}.bb-journey-step:not(:nth-child(3)):not(:last-child):after{content:"→";position:absolute;right:-9px;top:50%;z-index:2;color:var(--blue);font-weight:800}
        .bb-categories{background:var(--paper)}.bb-category-grid{margin-top:54px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.bb-category{min-height:260px;position:relative;overflow:hidden;background:var(--navy);color:white}.bb-category img{object-fit:cover;filter:saturate(.75) contrast(1.05);transition:transform .35s,filter .35s}.bb-category:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,23,42,.08),rgba(15,23,42,.82))}.bb-category:hover img{transform:scale(1.05);filter:saturate(1) contrast(1.05)}.bb-img-1 img{object-position:15% 60%}.bb-img-2 img{object-position:78% 40%}.bb-img-3 img{object-position:38% 42%}.bb-img-4 img{object-position:64% 70%}.bb-img-5 img{object-position:86% 55%}.bb-img-6 img{object-position:8% 78%}.bb-img-7 img{object-position:55% 15%}.bb-img-8 img{object-position:30% 65%}.bb-category-content{position:absolute;z-index:2;left:21px;right:21px;bottom:20px;display:flex;align-items:center;gap:12px}.bb-category-content span{flex:1;font-size:13px;font-weight:720}.bb-category-content svg:last-child{transition:transform .2s}.bb-category:hover .bb-category-content svg:last-child{transform:translateX(4px)}
        .bb-transparency{display:grid;grid-template-columns:.9fr 1.1fr;gap:clamp(55px,9vw,140px);align-items:center;background:var(--navy);color:white}.bb-transparency .bb-label{color:#60a5fa}.bb-transparency h2{margin:14px 0 20px;color:white;font-size:clamp(40px,4.8vw,68px);font-weight:690;letter-spacing:-.06em;line-height:1.04}.bb-transparency-copy>p{max-width:600px;margin:0;color:#94a3b8;font-size:14px;line-height:1.75}.bb-transparency-list{border-top:1px solid #334155}.bb-transparency-list p{margin:0;padding:22px 0;display:flex;gap:14px;border-bottom:1px solid #334155;color:#f8fafc;font-size:12px;line-height:1.6}.bb-transparency-list svg{flex:none;color:#60a5fa}.bb-transparency .bb-button{margin-top:28px}
        .bb-story{display:grid;grid-template-columns:.8fr 1.2fr;gap:clamp(50px,10vw,150px);background:white}.bb-story-copy{max-width:830px}.bb-story-copy p{margin:0;color:#334155;font-size:clamp(18px,2vw,25px);line-height:1.65;letter-spacing:-.022em}.bb-story-copy p+p{margin-top:27px;padding-top:27px;border-top:1px solid var(--line);color:var(--slate);font-size:14px;letter-spacing:0;line-height:1.8}
        .bb-culture{margin:0 clamp(18px,6vw,92px) clamp(78px,8vw,124px);padding:clamp(45px,6vw,82px);display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;border:1px solid var(--line);background:var(--cream)}.bb-culture h2{margin:13px 0 0;color:var(--navy);font-size:clamp(36px,4vw,56px);font-weight:690;letter-spacing:-.055em;line-height:1.05}.bb-culture p{margin:0;color:var(--slate);font-size:15px;line-height:1.8}
        .bb-faq{display:grid;grid-template-columns:.7fr 1.3fr;gap:clamp(55px,9vw,140px);background:var(--cream)}.bb-faq-list{border-top:1px solid var(--line)}.bb-faq-list article{border-bottom:1px solid var(--line)}.bb-faq-list h3{margin:0}.bb-faq-list button{width:100%;min-height:78px;padding:0;display:flex;align-items:center;justify-content:space-between;gap:22px;border:0;background:transparent;color:var(--navy);text-align:left;cursor:pointer;font-size:14px;font-weight:690}.bb-faq-list button>span{display:flex;align-items:center;gap:18px}.bb-faq-list button small{color:var(--blue);font-family:monospace;font-size:11px;font-weight:700}.bb-faq-list button svg{flex:none;color:var(--blue);transition:transform .2s}.bb-faq-list button[aria-expanded=true] svg{transform:rotate(180deg)}.bb-faq-answer p{max-width:680px;margin:-5px 45px 25px 34px;color:var(--slate);font-size:12px;line-height:1.8}
        .bb-final{padding:clamp(76px,9vw,128px) 20px;text-align:center;background:var(--blue);color:white}.bb-final .bb-label{color:#bfdbfe}.bb-final h2{max-width:850px;margin:16px auto 19px;font-size:clamp(43px,5.4vw,76px);font-weight:690;letter-spacing:-.063em;line-height:1}.bb-final>p{max-width:610px;margin:0 auto;color:#dbeafe;font-size:14px;line-height:1.7}.bb-final-actions{margin-top:31px;display:flex;justify-content:center;flex-wrap:wrap;gap:10px}.bb-final .bb-button-secondary{border-color:rgba(255,255,255,.5);background:transparent;color:white}.bb-final-seller{margin-top:20px!important;color:#eff6ff!important;font-size:11px!important}.bb-final-seller a{border-bottom:1px solid rgba(255,255,255,.55);font-weight:750}
        @media(prefers-reduced-motion:reduce){.bb-about *,.bb-about *:before,.bb-about *:after{scroll-behavior:auto!important;animation-duration:.01ms!important;transition-duration:.01ms!important}}
        @media(max-width:1100px){.bb-hero{grid-template-columns:1fr 1fr;gap:45px}.bb-challenge-grid,.bb-category-grid{grid-template-columns:repeat(2,1fr)}.bb-review-layout{grid-template-columns:1fr}.bb-journey-track{grid-template-columns:repeat(2,1fr)}.bb-journey-step:not(:last-child):after{display:none}}
        @media(max-width:800px){.bb-hero,.bb-purpose,.bb-audience,.bb-transparency,.bb-story,.bb-faq,.bb-culture{grid-template-columns:1fr}.bb-hero{background:var(--paper)}.bb-catalogue{min-height:500px}.bb-purpose,.bb-story{gap:32px}.bb-approach-grid{grid-template-columns:1fr}.bb-audience{gap:40px}.bb-review-points{grid-template-columns:1fr}.bb-principle{grid-template-columns:55px 1fr}.bb-principle p{grid-column:2}.bb-culture{gap:24px}.bb-faq{gap:48px}}
        @media(max-width:560px){.bb-section{padding:72px 18px}.bb-hero{min-height:auto;padding:55px 18px 72px}.bb-hero h1{font-size:46px}.bb-hero-actions{flex-direction:column}.bb-catalogue{min-height:440px;grid-template-columns:1fr 1fr;grid-template-rows:1.2fr .8fr}.bb-catalogue-card:first-child{grid-column:1/3;grid-row:auto}.bb-catalogue-card:nth-child(3){grid-column:auto}.bb-purpose-copy h2{font-size:43px}.bb-challenge-grid,.bb-category-grid,.bb-journey-track{grid-template-columns:1fr}.bb-challenge{min-height:240px}.bb-approach-card{grid-template-columns:40px 1fr;padding:26px 20px}.bb-audience-panel{min-height:510px;padding:34px 24px}.bb-tabs{width:100%}.bb-tabs button{flex:1;padding:0 12px}.bb-stage-line{padding:25px 16px;grid-template-columns:1fr;gap:0}.bb-stage{padding:0 0 26px;display:grid;grid-template-columns:40px 1fr;align-items:center;text-align:left;gap:14px}.bb-stage:last-child{padding-bottom:0}.bb-stage:not(:last-child):after{top:36px;left:18px;width:1px;height:calc(100% - 18px)}.bb-stage span{margin:0}.bb-review-outcomes{padding:25px}.bb-principle{grid-template-columns:40px 1fr;gap:16px}.bb-principle h3{font-size:18px}.bb-principle p{grid-column:2}.bb-journey-step{min-height:155px}.bb-category{min-height:230px}.bb-culture{margin:0 18px 72px;padding:35px 24px}.bb-final-actions{flex-direction:column;align-items:stretch;margin-left:auto;margin-right:auto;max-width:420px}.bb-faq-list button>span{gap:10px}.bb-faq-answer p{margin-left:24px}}
        @media(max-width:360px){.bb-hero h1{font-size:40px}.bb-catalogue{min-height:400px}.bb-heading h2,.bb-audience h2{font-size:36px}.bb-audience-panel h3{font-size:33px}}
      `}</style>
      <div className="min-h-screen bg-white text-[#0f172a] selection:bg-[#2563eb] selection:text-white">
        <Navbar />
        <main className="bb-about">
          <section className="bb-hero" aria-labelledby="about-title">
            <div className="bb-hero-copy">
              <span className="bb-label">About bidmylot</span>
              <h1 id="about-title">
                A clearer way to bring buyers, sellers and{" "}
                <em>valuable products</em> together.
              </h1>
              <p>
                bidmylot is building an online auction marketplace designed
                around clear information, considered review and a
                straightforward experience for everyone participating.
              </p>
              <div className="bb-hero-actions">
                <Link className="bb-button bb-button-primary" href="/auctions">
                  Explore Auctions
                  <ArrowRight size={17} />
                </Link>
                <Link
                  className="bb-button bb-button-secondary"
                  href="/how-it-works"
                >
                  See How It Works
                </Link>
              </div>
              <div className="bb-hero-note">
                <ShieldCheck size={19} aria-hidden="true" />
                <span>
                  Seller submissions are reviewed before they are eligible to
                  appear on the public marketplace.
                </span>
              </div>
            </div>
            <div
              className="bb-catalogue"
              aria-label="A curated collection of auction categories"
            >
              <div className="bb-catalogue-card">
                <Image
                  src={heroPhotos?.heroImage1 || DEFAULT_HERO_IMAGE}
                  alt="A curated catalogue arrangement of collectible auction items"
                  fill
                  priority
                  sizes="(max-width: 800px) 100vw, 38vw"
                />
                <span className="bb-catalogue-mark">Curated marketplace</span>
                <div className="bb-catalogue-tag">
                  <span>
                    <small>Collectibles</small>Objects worth discovering
                  </span>
                  <Gem size={20} />
                </div>
              </div>
              <div className="bb-catalogue-card">
                <Image
                  src={heroPhotos?.heroImage2 || DEFAULT_HERO_IMAGE}
                  alt="Camera and premium accessories prepared for auction"
                  fill
                  sizes="(max-width: 800px) 50vw, 18vw"
                />
                <div className="bb-catalogue-tag">
                  <span>
                    <small>Electronics</small>Considered details
                  </span>
                  <Camera size={18} />
                </div>
              </div>
              <div className="bb-catalogue-card">
                <Image
                  src={heroPhotos?.heroImage3 || DEFAULT_HERO_IMAGE}
                  alt="Premium items represented in an auction catalogue"
                  fill
                  sizes="(max-width: 800px) 50vw, 18vw"
                />
                <div className="bb-catalogue-tag">
                  <span>
                    <small>Lifestyle</small>One clear place
                  </span>
                  <Sparkles size={18} />
                </div>
              </div>
            </div>
          </section>

          <section
            className="bb-section bb-purpose"
            aria-labelledby="purpose-title"
          >
            <span className="bb-label">Why we exist</span>
            <div className="bb-purpose-copy">
              <h2 id="purpose-title">
                Online auctions should feel understandable, not intimidating.
              </h2>
              <p>
                Finding the right product, understanding an auction and deciding
                when to participate should not require navigating a confusing
                marketplace. bidmylot is being created to make each stage
                easier to follow—from discovering an approved listing to
                tracking an auction from your dashboard.
              </p>
              <p>
                For sellers, the platform provides a structured way to prepare a
                product, propose an auction schedule and submit the listing for
                review before it becomes publicly available.
              </p>
            </div>
          </section>

          <section
            className="bb-section bb-challenges"
            aria-labelledby="challenges-title"
          >
            <SectionTitle
              label="The marketplace problem"
              title="What we are trying to improve"
              copy="A more useful auction experience begins by removing uncertainty from the information, process and status around each listing."
            />
            <div className="bb-challenge-grid">
              {challenges.map(({ number, title, copy, icon: Icon }) => (
                <article className="bb-challenge" key={number}>
                  <div className="bb-challenge-top">
                    <Icon size={23} aria-hidden="true" />
                    <small>{number}</small>
                  </div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </section>

          <section
            className="bb-section bb-approach"
            aria-labelledby="approach-title"
          >
            <SectionTitle
              label="bidmylot's approach"
              title="Our approach"
              copy="A restrained, role-aware marketplace built around the information and steps that people actually need."
            />
            <div className="bb-approach-grid">
              {approaches.map(([title, copy], index) => (
                <article className="bb-approach-card" key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <AudienceTabs />

          <section
            className="bb-section bb-review"
            aria-labelledby="review-title"
          >
            <SectionTitle
              label="A considered checkpoint"
              title="Why listings are reviewed"
              copy="Public auction discovery should remain organised and relevant. Seller submissions therefore pass through an admin-review stage before becoming publicly visible."
            />
            <div className="bb-review-layout">
              <div
                className="bb-stage-line"
                aria-label="Standard listing review path"
              >
                {reviewStages.map((stage, index) => (
                  <div className="bb-stage" key={stage}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <b>{stage}</b>
                  </div>
                ))}
              </div>
              <aside
                className="bb-review-outcomes"
                aria-label="Alternate review outcomes"
              >
                <small>Alternate outcomes</small>
                <div className="bb-outcome">
                  Changes Requested
                  <span />
                </div>
                <div className="bb-outcome">
                  Rejected
                  <span />
                </div>
              </aside>
            </div>
            <ul className="bb-review-points">
              <li>Drafts remain private.</li>
              <li>Submitted listings do not automatically become public.</li>
              <li>Admins can approve, reject or request changes.</li>
              <li>
                Only approved auctions are eligible for public publication.
              </li>
              <li>Publication must follow the approved schedule.</li>
              <li>
                Sellers can track the current status from their dashboard.
              </li>
            </ul>
            <p className="bb-clarification">
              Review helps confirm that a submission contains the information
              required by the marketplace. It should not be interpreted as an
              unconditional guarantee of a product, seller or transaction.
            </p>
          </section>

          <section
            className="bb-section bb-principles"
            aria-labelledby="principles-title"
          >
            <SectionTitle
              label="What guides us"
              title="The principles guiding bidmylot"
            />
            <div className="bb-principle-list">
              {principles.map(([title, copy], index) => (
                <article className="bb-principle" key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </section>

          <section
            className="bb-section bb-journey"
            aria-labelledby="journey-title"
          >
            <SectionTitle
              label="From private draft to public auction"
              title="One marketplace journey, clearly staged."
              copy="Each transition has a different owner and purpose, keeping private preparation separate from review and public participation."
            />
            <div className="bb-journey-track">
              {journey.map(([label, title, meta], index) => (
                <article className="bb-journey-step" key={title}>
                  <span>{label}</span>
                  <h3>
                    {String(index + 1).padStart(2, "0")} — {title}
                  </h3>
                  <p>{meta}</p>
                </article>
              ))}
            </div>
          </section>

          <section
            className="bb-section bb-categories"
            aria-labelledby="categories-title"
          >
            <SectionTitle
              label="Marketplace range"
              title="Different categories. The same clear path."
              copy="Explore the intended range of bidmylot auctions without inflated counts or unsupported claims."
            />
            <div className="bb-category-grid">
              {(aboutCategories.length > 0
                ? aboutCategories.filter(
                  (c) =>
                    c &&
                    c.isDisplayed !== false &&
                    c.isDisplayed !== "false" &&
                    c.isDisplayed !== 0,
                )
                : []
              ).map((cat, index) => {
                const Icon = getCategoryIcon(cat.slug, cat.name);
                const photoSrc = resolveImageUrl(cat.imageUrl || DEFAULT_HERO_IMAGE);
                return (
                  <Link
                    className="bb-category"
                    href={`/auctions?category=${encodeURIComponent(cat.name)}`}
                    key={cat.id || cat.slug || index}
                  >
                    <Image
                      src={photoSrc}
                      alt={cat.name || "Category"}
                      fill
                      sizes="(max-width: 560px) 100vw, (max-width: 1100px) 50vw, 25vw"
                    />
                    <span className="bb-category-content">
                      <Icon size={20} aria-hidden="true" />
                      <span>{cat.name}</span>
                      <ArrowRight size={18} aria-hidden="true" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          <section
            className="bb-section bb-transparency"
            aria-labelledby="transparency-title"
          >
            <div className="bb-transparency-copy">
              <span className="bb-label">Trust through transparency</span>
              <h2 id="transparency-title">
                Trust begins with knowing how the platform works.
              </h2>
              <p>
                Good marketplace decisions depend on visible status,
                understandable rules and clearly separated responsibilities.
              </p>
              <Link className="bb-button bb-button-light" href="/how-it-works">
                Understand the complete process
                <ArrowRight size={17} />
              </Link>
            </div>
            <div className="bb-transparency-list">
              <p>
                <BadgeCheck size={19} />
                Public auctions are limited to listings that completed platform
                review.
              </p>
              <p>
                <Clock3 size={19} />
                Auction status and timing should be clearly displayed.
              </p>
              <p>
                <UserRoundCheck size={19} />
                Buyer and seller actions are separated by account role.
              </p>
              <p>
                <ShieldCheck size={19} />
                Important auction actions must be validated by the server.
              </p>
              <p>
                <Aperture size={19} />
                Marketplace policies should be available before participation.
              </p>
            </div>
          </section>

          <section
            className="bb-section bb-story"
            aria-labelledby="story-title"
          >
            <div>
              <span className="bb-label">Company story</span>
              <div className="bb-heading">
                <h2 id="story-title">Building bidmylot</h2>
              </div>
            </div>
            <div className="bb-story-copy">
              <p>
                bidmylot began with a simple observation: online auction
                experiences often become more complicated than the decision a
                person is trying to make. The platform is being developed to
                create a more organised path between sellers preparing valuable
                products and buyers looking for worthwhile opportunities.
              </p>
              <p>
                Our focus is not to add unnecessary complexity. It is to build
                the essential marketplace tools carefully—public auction
                discovery, structured seller submissions, admin review, bidding
                participation and role-specific tracking.
              </p>
            </div>
          </section>

          <section className="bb-culture" aria-labelledby="culture-title">
            <div>
              <span className="bb-label">How we work</span>
              <h2 id="culture-title">
                A marketplace shaped by different perspectives
              </h2>
            </div>
            <div>
              <p>
                Building a dependable auction experience requires product
                thinking, marketplace operations, review workflows, technology
                and customer support to work together.
              </p>
            </div>
          </section>

          <FAQSection />

          <section className="bb-final" aria-labelledby="final-title">
            <span className="bb-label">Take the next step</span>
            <h2 id="final-title">Explore what bidmylot is building.</h2>
            <p>
              Discover approved public auctions or learn how the marketplace
              works for buyers and sellers.
            </p>
            <div className="bb-final-actions">
              <Link className="bb-button bb-button-light" href="/auctions">
                Explore Auctions
                <ArrowRight size={17} />
              </Link>
              <Link
                className="bb-button bb-button-secondary"
                href="/how-it-works"
              >
                How It Works
              </Link>
            </div>
            <p className="bb-final-seller">
              Planning to sell?{" "}
              <Link href="/seller/register">Create a seller account.</Link>
            </p>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
}
