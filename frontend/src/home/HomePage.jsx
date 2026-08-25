import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Car,
  ChevronDown,
  Clock3,
  Factory,
  Gem,
  Headphones,
  Heart,
  History,
  Home,
  Laptop,
  Lock,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Timer,
  UserRoundCheck,
} from "lucide-react";
import { EmptyState, ErrorState, Footer, Image, Link, LoadingState, Navbar } from "../components";
import api from "../lib/api";
import { errorMessage, formatDateTime, formatINR } from "../lib/format";
import { useAuctionTiming } from "../hooks/useCountdown";
import { useAuth } from "../auth/AuthContext";

const categories = [
  {
    name: "Electronics & Tech",
    description: "Cameras, audio, computing and devices",
    slug: "electronics",
    icon: Laptop,
  },
  {
    name: "Automotive & Vehicles",
    description: "Inspected cars and two-wheelers",
    slug: "vehicles",
    icon: Car,
  },
  {
    name: "Antiques & Collectibles",
    description: "Art, coins, memorabilia and rare finds",
    slug: "collectibles",
    icon: Camera,
  },
  {
    name: "Fashion & Luxury",
    description: "Luxury apparel, bags and designer items",
    slug: "fashion-luxury",
    icon: ShoppingBag,
  },
  {
    name: "Jewelry & Watches",
    description: "Fine jewelry, watches and precious gems",
    slug: "jewelry-watches",
    icon: Gem,
  },
  {
    name: "Industrial & Equipment",
    description: "Machinery, tools and business assets",
    slug: "industrial-equipment",
    icon: Factory,
  },
  {
    name: "Home & Lifestyle",
    description: "Furniture, décor and home appliances",
    slug: "home-lifestyle",
    icon: Home,
  },
  {
    name: "Other",
    description: "Distinctive lots worth exploring",
    slug: "other",
    icon: Sparkles,
  },
];

const faqItems = [
  [
    "How do I participate in an auction?",
    "Create a buyer account, open an approved auction and review its details before placing a bid. Your dashboard will keep the auction and its result in one place.",
  ],
  [
    "Do I need an account to place a bid?",
    "Yes. You can browse without signing in, but bidding requires a buyer account so participation and auction activity can be recorded clearly.",
  ],
  [
    "How can I list a product?",
    "Create a seller account, add the product and auction details, then submit the listing for review. It will not appear publicly until the bidmylot team approves it.",
  ],
  [
    "Why does an auction require admin approval?",
    "Review helps confirm that the listing has the information buyers need and follows marketplace requirements before it is published.",
  ],
  [
    "How long does approval take?",
    "The expected review window is up to 48 hours after a complete submission. Complex or incomplete listings may need more time or additional information.",
  ],
  [
    "What happens after an auction ends?",
    "The confirmed deal appears in both dashboards, where buyer and seller can contact each other directly.",
  ],
  [
    "How can I contact customer support?",
    "Visit the Support page to find help topics and contact options for your buyer or seller query.",
  ],
];

const statusCopy = {
  live: "Live Now",
  upcoming: "Opening Soon",
  "ending-soon": "Ending Soon",
  closed: "Recently Closed",
};

const statusStyles = {
  live: "border-emerald-300 bg-emerald-50 text-emerald-800",
  upcoming: "border-blue-300 bg-blue-50 text-blue-800",
  "ending-soon": "border-amber-300 bg-amber-50 text-amber-800",
  closed: "border-slate-700 bg-slate-900 text-slate-200",
};

function StatusBadge({ status }) {
  const isUpcoming = status === "upcoming";
  const isClosed = status === "closed";
  const isLive = status === "live" || status === "ending-soon";

  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-3 text-[10px] font-extrabold uppercase tracking-[0.09em] shadow-xs backdrop-blur-xs ${statusStyles[status] || statusStyles.live
        }`}
      aria-label={`Auction status: ${statusCopy[status] || "Live Now"}`}
    >
      {isClosed && <Lock className="h-3 w-3 text-slate-400" aria-hidden="true" />}
      {isUpcoming && <Timer className="h-3 w-3 animate-spin-slow text-blue-600" aria-hidden="true" />}
      {isLive && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${status === "ending-soon" ? "bg-amber-500 animate-ping" : "bg-emerald-500 animate-pulse"
            }`}
          aria-hidden="true"
        />
      )}
      {statusCopy[status] || "Live Now"}
    </span>
  );
}

function AuctionCard({ auction }) {
  const { user } = useAuth();
  const [watched, setWatched] = useState(Boolean(auction.isWatched));
  const [watchError, setWatchError] = useState("");
  const [savingWatch, setSavingWatch] = useState(false);

  const status = auction.publicDisplayStatus || auction.status || "live";
  const slug = auction.publicSlug || auction.slug || String(auction.id);
  const imageUrl = auction.primaryImageUrl || auction.image || (Array.isArray(auction.images) && auction.images[0]?.imageUrl) || "/hero-auction-marketplace.png";
  const categoryName =
    typeof auction.categoryName === "string"
      ? auction.categoryName
      : typeof auction.category === "string"
        ? auction.category
        : auction.category?.name || "General";
  const amount = auction.currentBid ?? auction.startingPrice ?? auction.askingPrice ?? 0;
  const starts = auction.startTime || auction.startsAt || auction.start_time;
  const ends = auction.endTime || auction.endsAt || auction.end_time;
  const ref = auction.listingReference || auction.lotNumber || `LOT-${auction.id}`;

  const timing = useAuctionTiming(starts, ends, status);
  const isUpcoming = timing.isUpcoming || status === "upcoming";
  const isClosed = timing.isClosed || status === "closed";

  const priceLabel =
    isUpcoming
      ? "Starting Price"
      : isClosed
        ? "Final Bid / Asking"
        : "Asking Price";

  useEffect(() => setWatched(Boolean(auction.isWatched)), [auction.isWatched]);

  const toggleWatchlist = async () => {
    if (!user) {
      window.location.assign(`/login?returnTo=${encodeURIComponent(`/auctions/${slug}`)}`);
      return;
    }
    if (user.role !== "buyer" && user.accountType !== "buyer") {
      setWatchError("Only buyer accounts can use a watchlist.");
      return;
    }
    setSavingWatch(true);
    setWatchError("");
    try {
      const response = watched
        ? await api.delete(`/watchlist/${auction.id}`)
        : await api.post(`/watchlist/${auction.id}`);
      setWatched(response.data.watched);
    } catch (error) {
      setWatchError(errorMessage(error, "The watchlist could not be updated."));
    } finally {
      setSavingWatch(false);
    }
  };

  return (
    <article
      className={`group overflow-hidden rounded-2xl border transition duration-300 hover:-translate-y-1 motion-reduce:transform-none ${isClosed
          ? "border-slate-300 bg-slate-50/90 hover:border-slate-400 hover:shadow-md"
          : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-[0_18px_40px_rgba(15,23,42,.08)]"
        }`}
    >
      <div className="relative h-56 overflow-hidden bg-slate-900">
        <Image
          src={imageUrl}
          alt={`${auction.title || "Item"} preview`}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className={`object-cover transition duration-500 motion-reduce:transform-none ${isClosed
              ? "grayscale contrast-125 opacity-75 group-hover:grayscale-0 group-hover:opacity-100"
              : "group-hover:scale-[1.04]"
            }`}
          style={{ objectPosition: auction.imagePosition || "center" }}
        />
        <div
          className={`absolute inset-0 ${isClosed
              ? "bg-slate-950/35"
              : "bg-gradient-to-b from-transparent via-transparent to-[#0f172a]/40"
            }`}
          aria-hidden="true"
        />
        <div className="absolute left-3 top-3">
          <StatusBadge status={isClosed ? "closed" : isUpcoming ? "upcoming" : timing.phase} />
        </div>
        <button
          type="button"
          onClick={toggleWatchlist}
          disabled={savingWatch}
          aria-pressed={watched}
          aria-label={
            watched
              ? `Remove ${auction.title} from watchlist`
              : `Add ${auction.title} to watchlist`
          }
          className={`absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border backdrop-blur-xs transition ${watched
              ? "border-red-200 bg-white/95 text-red-600 shadow-sm"
              : "border-white/70 bg-white/85 text-slate-600 hover:bg-white hover:text-slate-900"
            }`}
        >
          <Heart
            className="h-[18px] w-[18px]"
            fill={watched ? "currentColor" : "none"}
          />
        </button>

        {/* Live bottom overlay timer */}
        <div
          className={`absolute inset-x-0 bottom-0 flex items-center justify-between px-3 py-1.5 backdrop-blur-xs text-[11px] ${isClosed ? "bg-slate-900/90 text-slate-300 font-mono" : "bg-slate-950/65 text-white"
            }`}
        >
          <span className={isClosed ? "text-slate-400 font-medium" : "text-slate-300 font-medium"}>
            {timing.countdownLabel}:
          </span>
          <span
            className={`font-mono font-bold ${isClosed
                ? "text-slate-300"
                : isUpcoming
                  ? "text-blue-300"
                  : timing.isEndingSoon
                    ? "text-amber-300"
                    : "text-emerald-300"
              }`}
          >
            {timing.formattedTime}
          </span>
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between gap-3 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">
          <span>{categoryName}</span>
          <span className={`inline-flex items-center gap-1 ${isClosed ? "text-slate-500" : "text-emerald-600"}`}>
            <BadgeCheck className="h-3.5 w-3.5" /> Admin-reviewed
          </span>
        </div>
        <h3
          className={`mt-2 min-h-12 text-[17px] font-bold leading-6 tracking-[-0.025em] line-clamp-2 transition-colors ${isClosed
              ? "text-slate-700 group-hover:text-slate-900"
              : "text-[#0f172a] group-hover:text-blue-600"
            }`}
        >
          {auction.title}
        </h3>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Car className="h-3.5 w-3.5" />
            {categoryName}
          </span>
          <span className={`font-semibold ${isClosed ? "text-slate-500" : "text-slate-600"}`}>Verified Lot</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-y border-slate-200 py-3">
          <div>
            <p className="text-[9px] uppercase tracking-[0.08em] text-slate-500">
              {priceLabel}
            </p>
            <p className={`mt-1 text-[15px] font-extrabold ${isClosed ? "text-slate-600" : "text-[#0f172a]"}`}>
              {formatINR(amount)}
            </p>
          </div>
          <div className="border-l border-slate-200 pl-3 text-right">
            <p className="text-[9px] uppercase tracking-[0.08em] text-slate-500">
              {auction.bidCount ?? auction.bids ?? 0} offers
            </p>
            <p className="mt-1 text-xs font-bold text-[#0f172a]">
              {isUpcoming && starts
                ? `Starts ${formatDateTime(starts)}`
                : isClosed
                  ? "Listing closed"
                  : ends
                    ? `Ends ${formatDateTime(ends)}`
                    : "Active"}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span
            className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${isClosed
                ? "border-slate-300 bg-slate-200 text-slate-700"
                : "border-blue-100 bg-blue-50 text-[#2563eb]"
              }`}
          >
            {ref}
          </span>
          <Link
            href={`/auctions/${slug}`}
            className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-4 text-xs font-bold transition-colors ${isClosed
                ? "border-slate-300 bg-slate-800 text-slate-200 hover:bg-slate-900"
                : isUpcoming
                  ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "border-slate-300 text-[#0f172a] hover:border-[#2563eb] hover:text-[#2563eb]"
              }`}
          >
            {isClosed ? "View Archive" : isUpcoming ? "Preview Lot" : "View Listing"} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {watchError ? <p className="mt-2 text-[10px] text-red-700">{watchError}</p> : null}
      </div>
    </article>
  );
}

function HeroSection() {
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [auctions, setAuctions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let active = true;
    api
      .get("/listings", { params: { pageSize: 5, status: "live" } })
      .then(({ data }) => {
        if (active && data.items?.length > 0) {
          setAuctions(data.items);
        }
      })
      .catch((error) => console.error("Error fetching hero listings:", error));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (auctions.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % auctions.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [auctions.length]);

  const handleSearch = (event) => {
    event.preventDefault();

    if (!search.trim()) {
      setMessage("Enter a product, category or auction ID.");
      return;
    }
    window.location.assign(`/auctions?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <section className="border-b border-slate-200 bg-[#f8fafc] px-5 py-14 md:px-[5vw] md:py-20">
      <div className="mx-auto grid max-w-[1440px] items-center gap-12 lg:grid-cols-[1.15fr_0.95fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#2563eb]/25 bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-[#2563eb]">
            <ShieldCheck className="h-4 w-4" /> Reviewed listings. Transparent
            bidding.
          </div>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-[-0.04em] text-[#0f172a] sm:text-5xl lg:text-6xl">
            Bid with confidence.
            <br />
            <span className="text-[#2563eb]">Sell with transparency.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
            Discover reviewed auction items, participate in real-time auctions,
            or list your item for admin review—all through one curated
            marketplace.
          </p>
          <form
            onSubmit={handleSearch}
            className="mt-8 flex max-w-xl flex-col gap-2 rounded-[5px] border border-slate-300 bg-white p-2 shadow-sm sm:flex-row sm:items-center"
          >
            <Search className="ml-3 hidden h-5 w-5 text-slate-400 sm:block" />
            <label className="sr-only" htmlFor="hero-search">
              Search auctions
            </label>
            <input
              id="hero-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by product, category or lot ID"
              className="h-11 min-w-0 flex-1 px-3 text-sm outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="min-h-11 rounded-[3px] bg-[#0f172a] px-6 text-xs font-bold text-white hover:bg-[#2563eb]"
            >
              Search
            </button>
          </form>
          {message && (
            <p className="mt-2 text-xs font-semibold text-[#2563eb]">
              {message}
            </p>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/auctions"
              className="inline-flex min-h-11 items-center gap-2 rounded-[4px] bg-[#2563eb] px-6 text-xs font-bold text-white shadow-sm transition hover:bg-[#1d4ed8]"
            >
              Explore Live Auctions <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/seller/register"
              className="inline-flex min-h-11 items-center gap-2 rounded-[4px] border border-slate-300 bg-white px-6 text-xs font-bold text-[#0f172a] transition hover:border-[#2563eb] hover:text-[#2563eb]"
            >
              Sell on bidmylot
            </Link>
          </div>
          <div className="mt-10 flex items-start gap-3 border-t border-slate-200 pt-6 text-slate-600">
            <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#2563eb]" />
            <div>
              <p className="text-sm font-bold text-[#0f172a]">
                Admin-reviewed before publishing
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Buyers only see listings approved by the bidmylot team.
              </p>
            </div>
          </div>
        </div>

        <div className="relative h-[480px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg sm:h-[540px]">
          {auctions.length > 0 ? (
            auctions.map((auction, idx) => {
              const isActive = idx === currentIndex;
              const heroImg = auction.primaryImageUrl || auction.image || (Array.isArray(auction.images) && auction.images[0]?.imageUrl) || "/hero-auction-marketplace.png";
              const heroAmt = auction.currentBid ?? auction.startingPrice ?? auction.askingPrice ?? auction.current_bid ?? auction.starting_price ?? 0;
              const heroDate = auction.endTime || auction.end_time || auction.endsAt;
              const heroDateStr = heroDate ? new Date(heroDate).toLocaleDateString() : "Ongoing";
              const heroSlug = auction.publicSlug || auction.slug || String(auction.id);
              const heroRef = auction.listingReference || auction.lotNumber || `LOT #${auction.id}`;

              return (
                <div
                  key={auction.id}
                  className={`absolute inset-0 transition-opacity duration-1000 ${isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
                    }`}
                >
                  <Image
                    src={heroImg}
                    alt={auction.title || "Auction item"}
                    fill
                    priority={idx === 0}
                    sizes="(max-width: 800px) 100vw, 50vw"
                  />
                  <div className="absolute bottom-6 left-6 right-6 rounded-xl border border-slate-200 bg-white/95 p-5 shadow-xl backdrop-blur">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />{" "}
                        Live Listing
                      </span>
                      <span className="text-xs font-semibold text-slate-500 uppercase">
                        {heroRef}
                      </span>
                    </div>
                    <h2 className="mt-3 text-lg font-bold text-[#0f172a] truncate">
                      {auction.title}
                    </h2>
                    <div className="mt-3 grid grid-cols-2 gap-4 border-y border-slate-200 py-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">
                          Asking Price
                        </p>
                        <p className="mt-0.5 text-lg font-extrabold text-[#2563eb]">
                          {formatINR(heroAmt)}
                        </p>
                      </div>
                      <div className="border-l border-slate-200 pl-4 text-right">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">
                          End Date
                        </p>
                        <p className="mt-0.5 text-sm font-bold text-[#0f172a] truncate">
                          {heroDateStr}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/auctions/${heroSlug}`}
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#2563eb] hover:underline"
                    >
                      View listing <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })
          ) : (
            <>
              <Image
                src="/hero-auction-marketplace.png"
                alt="Curated auction items"
                fill
                priority
                sizes="(max-width: 800px) 100vw, 50vw"
              />
              <div className="absolute bottom-6 left-6 right-6 rounded-xl border border-slate-200 bg-white/95 p-5 shadow-xl backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />{" "}
                    Live Auction
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    PUBLIC MARKETPLACE
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-bold text-[#0f172a]">
                  Approved auction listings
                </h2>
                <div className="mt-3 grid grid-cols-2 gap-4 border-y border-slate-200 py-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">
                      Pricing
                    </p>
                    <p className="mt-0.5 text-lg font-extrabold text-[#2563eb]">
                      Server verified
                    </p>
                  </div>
                  <div className="border-l border-slate-200 pl-4 text-right">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">
                      Timing
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-[#0f172a]">
                      Live updates
                    </p>
                  </div>
                </div>
                <Link
                  href="/auctions"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#2563eb] hover:underline"
                >
                  View auction <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  const items = [
    [
      UserRoundCheck,
      "Admin-reviewed listings",
      "Reviewed before they go public",
    ],
    [Clock3, "Transparent bidding", "Clear timelines and bid activity"],
    [ShieldCheck, "Secure user accounts", "Account access designed with care"],
    [Headphones, "Dedicated support", "Help for buyers and sellers"],
  ];
  return (
    <section
      className="border-b border-slate-200 bg-white px-5 py-10 md:px-[5vw]"
      aria-label="Marketplace trust indicators"
    >
      <div className="mx-auto grid max-w-[1440px] gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([Icon, title, copy]) => (
          <article
            key={title}
            className="flex items-start gap-4 rounded-[4px] border border-slate-200 bg-[#f8fafc] p-5 transition hover:border-[#2563eb] hover:bg-white hover:shadow-sm"
          >
            <Icon className="mt-0.5 h-6 w-6 shrink-0 text-[#2563eb]" />
            <div>
              <b className="block text-sm font-bold text-[#0f172a]">{title}</b>
              <small className="mt-1 block text-xs text-slate-500">
                {copy}
              </small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FeaturedAuctions() {
  const [tab, setTab] = useState("all");
  const [state, setState] = useState({ loading: true, error: "", items: [] });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: "" }));
    const params = { featured: true, pageSize: 6 };
    if (tab !== "all") params.status = tab;
    api
      .get("/listings", { params })
      .then(({ data }) => {
        if (active) setState({ loading: false, error: "", items: data.items });
      })
      .catch((error) => {
        if (active) setState({ loading: false, error: errorMessage(error), items: [] });
      });
    return () => {
      active = false;
    };
  }, [tab]);

  return (
    <section className="border-b border-slate-200 bg-[#f8fafc] px-5 py-16 md:px-[5vw] md:py-24">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.15em] text-[#2563eb]">
              Curated lots
            </span>
            <h2 className="mt-2 text-3xl font-extrabold text-[#0f172a] sm:text-4xl">
              Featured Auctions
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Admin-reviewed luxury and industrial lots open for bidding.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 rounded-[4px] border border-slate-200 bg-white p-1.5 shadow-sm">
            {[
              ["all", "All Lots"],
              ["live", "Live Now"],
              ["upcoming", "Upcoming"],
              ["closed", "Recently Closed"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`rounded-[3px] px-4 py-2 text-xs font-bold transition ${tab === value
                  ? "bg-[#0f172a] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-[#0f172a]"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {state.loading ? <div className="mt-10"><LoadingState label="Loading featured auctions…" /></div> : null}
        {state.error ? <div className="mt-10"><ErrorState message={state.error} /></div> : null}
        {!state.loading && !state.error && (state.items || []).length ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {(state.items || []).map((auction) => <AuctionCard key={auction.id} auction={auction} />)}
          </div>
        ) : null}
        {!state.loading && !state.error && !(state.items || []).length ? (
          <div className="mt-10"><EmptyState title="No auctions in this category" description="Approved public auctions will appear here when they are available." /></div>
        ) : null}

        <div className="mt-12 text-center">
          <Link
            href="/auctions"
            className="inline-flex min-h-11 items-center gap-2 rounded-[4px] border border-slate-300 bg-white px-8 text-xs font-bold text-[#0f172a] shadow-sm transition hover:border-[#2563eb] hover:text-[#2563eb]"
          >
            Explore All Auctions <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function CategoriesSection() {
  return (
    <section className="border-b border-slate-200 bg-white px-5 py-16 md:px-[5vw] md:py-24">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.15em] text-[#2563eb]">
              Browse categories
            </span>
            <h2 className="mt-2 text-3xl font-extrabold text-[#0f172a] sm:text-4xl">
              What are you looking for?
            </h2>
          </div>
          <Link
            href="/auctions"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#2563eb] hover:underline"
          >
            View all categories <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map(({ name, description, icon: Icon }) => (
            <Link
              key={name}
              href={`/auctions?category=${encodeURIComponent(name)}`}
              className="group flex flex-col justify-between rounded-[4px] border border-slate-200 bg-[#f8fafc] p-6 transition duration-200 hover:-translate-y-1 hover:border-[#2563eb] hover:bg-white hover:shadow-md"
            >
              <div>
                <div className="inline-flex rounded-lg bg-blue-50 p-3 text-[#2563eb] group-hover:bg-[#2563eb] group-hover:text-white transition">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-[#0f172a]">
                  {name}
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {description}
                </p>
              </div>
              <span className="mt-6 inline-flex items-center gap-1 text-xs font-bold text-[#2563eb] group-hover:underline">
                Explore <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const [role, setRole] = useState("buyer");

  const steps =
    role === "buyer"
      ? [
        [
          "01",
          "Create an account",
          "Sign up in seconds to enable verified bidding across all marketplace categories.",
        ],
        [
          "02",
          "Explore reviewed lots",
          "Browse detailed item specifications, condition reports, and admin-verified listings.",
        ],
        [
          "03",
          "Place your bid",
          "Place eligible bids in real time with transparent auction clocks.",
        ],
        [
          "04",
          "Win & settle clearly",
          "Track the server-confirmed auction result from your buyer dashboard.",
        ],
      ]
      : [
        [
          "01",
          "Register as a seller",
          "Set up your seller profile and verify your credentials for marketplace trust.",
        ],
        [
          "02",
          "Submit lot details",
          "Provide high-resolution photos, starting price, and condition descriptions.",
        ],
        [
          "03",
          "Admin review",
          "Our team reviews your submission for quality and clarity within 48 hours.",
        ],
        [
          "04",
          "Go live & earn",
          "An approved lot becomes available to eligible buyers according to its schedule.",
        ],
      ];

  return (
    <section className="border-b border-slate-200 bg-[#f8fafc] px-5 py-16 md:px-[5vw] md:py-24">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.15em] text-[#2563eb]">
              Transparent process
            </span>
            <h2 className="mt-2 text-3xl font-extrabold text-[#0f172a] sm:text-4xl">
              How bidmylot Works
            </h2>
          </div>
          <div className="flex rounded-[4px] border border-slate-200 bg-white p-1.5 shadow-sm">
            <button
              type="button"
              onClick={() => setRole("buyer")}
              className={`rounded-[3px] px-6 py-2 text-xs font-bold transition ${role === "buyer"
                ? "bg-[#0f172a] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
                }`}
            >
              For Buyers
            </button>
            <button
              type="button"
              onClick={() => setRole("seller")}
              className={`rounded-[3px] px-6 py-2 text-xs font-bold transition ${role === "seller"
                ? "bg-[#0f172a] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
                }`}
            >
              For Sellers
            </button>
          </div>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([num, title, copy]) => (
            <article
              key={num}
              className="rounded-[4px] border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#2563eb]"
            >
              <span className="text-2xl font-black text-[#2563eb]">{num}</span>
              <h3 className="mt-4 text-base font-bold text-[#0f172a]">
                {title}
              </h3>
              <p className="mt-2 text-xs leading-6 text-slate-500">{copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function SellerCTA() {
  return (
    <section className="border-b border-slate-200 bg-white px-5 py-16 md:px-[5vw]">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-8 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/70 to-white p-8 md:flex-row md:p-14">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-[#2563eb]">
            <Sparkles className="h-3.5 w-3.5" /> Sell on bidmylot
          </span>
          <h2 className="mt-4 text-3xl font-extrabold text-[#0f172a] sm:text-4xl">
            Have a unique lot to sell?
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
            Reach marketplace buyers. Submit your luxury accessory,
            collectible, vehicle or industrial equipment for admin review today.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <Link
            href="/seller/register"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[4px] bg-[#2563eb] px-8 text-xs font-bold text-white shadow-sm transition hover:bg-[#1d4ed8]"
          >
            List an Item Now <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/how-it-works"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[4px] border border-slate-300 bg-white px-6 text-xs font-bold text-[#0f172a] transition hover:border-[#2563eb] hover:text-[#2563eb]"
          >
            Seller Guide
          </Link>
        </div>
      </div>
    </section>
  );
}

function WhyChoose() {
  const reasons = [
    [
      BadgeCheck,
      "01",
      "Admin-Verified Quality",
      "Every single listing is reviewed by our administration before being published to buyers.",
    ],
    [
      Clock3,
      "02",
      "Transparent Timers",
      "Real-time countdown clocks and bid increments ensure a level playing field for everyone.",
    ],
    [
      ShieldCheck,
      "03",
      "Server-Validated Bids",
      "Price, timing, role and auction eligibility are checked before a bid is accepted.",
    ],
    [
      Headphones,
      "04",
      "Dedicated Support",
      "Our customer service team assists with auction inquiries, verification, and disputes.",
    ],
  ];

  return (
    <section className="border-b border-slate-200 bg-[#f8fafc] px-5 py-16 md:px-[5vw] md:py-24">
      <div className="mx-auto max-w-[1440px]">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-[#2563eb]">
            Why bidmylot
          </span>
          <h2 className="mt-2 text-3xl font-extrabold text-[#0f172a] sm:text-4xl">
            The standard for trusted online auctions.
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Built to remove guesswork and provide a transparent bidding
            experience.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map(([Icon, num, title, copy]) => (
            <article
              key={num}
              className="rounded-[4px] border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#2563eb]"
            >
              <div className="flex items-center justify-between">
                <Icon className="h-6 w-6 text-[#2563eb]" />
                <span className="text-sm font-bold text-slate-300">{num}</span>
              </div>
              <h3 className="mt-5 text-base font-bold text-[#0f172a]">
                {title}
              </h3>
              <p className="mt-2 text-xs leading-6 text-slate-500">{copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="border-b border-slate-200 bg-white px-5 py-16 md:px-[5vw] md:py-24">
      <div className="mx-auto max-w-[1440px]">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-[#2563eb]">Marketplace feedback</span>
          <h2 className="mt-2 text-3xl font-extrabold text-[#0f172a] sm:text-4xl">
            Real feedback will appear here after launch.
          </h2>
        </div>

        <div className="mx-auto mt-8 max-w-2xl rounded-[4px] border border-dashed border-slate-300 bg-[#f8fafc] p-7 text-center text-sm leading-6 text-slate-600">
          bidmylot does not publish sample testimonials as customer claims. Verified feedback can be connected here when that data exists.
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="border-b border-slate-200 bg-[#f8fafc] px-5 py-16 md:px-[5vw] md:py-24">
      <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-[#2563eb]">
            Need assistance?
          </span>
          <h2 className="mt-2 text-3xl font-extrabold text-[#0f172a] sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Have questions about bidding, listing review, or account security?
            Here is what you need to know.
          </p>
          <div className="mt-6">
            <Link
              href="/support"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2563eb] hover:underline"
            >
              Visit Help Centre <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          {faqItems.map(([question, answer], index) => {
            const isOpen = openIndex === index;
            return (
              <article
                key={question}
                className="rounded-[4px] border border-slate-200 bg-white"
              >
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? -1 : index)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between p-5 text-left text-sm font-bold text-[#0f172a] hover:text-[#2563eb]"
                  >
                    <span>{question}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-[#2563eb] transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </h3>
                {isOpen && (
                  <div className="border-t border-slate-100 px-5 pb-5 pt-3 text-xs leading-6 text-slate-600">
                    {answer}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="bg-[#0f172a] px-5 py-20 text-center text-white md:px-[5vw]">
      <div className="mx-auto max-w-3xl">
        <span className="text-xs font-extrabold uppercase tracking-[0.15em] text-[#2563eb]">
          Ready to begin?
        </span>
        <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl md:text-5xl">
          Start your auction journey today.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-slate-400">
          Join India’s premium marketplace for admin-reviewed lots and
          transparent bidding.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/auctions"
            className="inline-flex min-h-11 items-center gap-2 rounded-[4px] bg-[#2563eb] px-8 text-xs font-bold text-white transition hover:bg-[#1d4ed8]"
          >
            Browse Live Auctions <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-11 items-center gap-2 rounded-[4px] border border-slate-700 bg-white/5 px-8 text-xs font-bold text-white transition hover:bg-white/10"
          >
            Create an Account
          </Link>
        </div>
      </div>
    </section>
  );
}

function RecentlyViewedSection() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("bidmylot_recently_viewed");
      const list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list)) setItems(list);
    } catch {
      // ignore
    }
  }, []);

  if (!items.length) return null;

  return (
    <section className="border-b border-slate-200 bg-white px-5 py-12 md:px-[5vw]">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.15em] text-[#2563eb] flex items-center gap-1.5">
              <History size={14} /> Jump Back In
            </span>
            <h2 className="mt-1 text-2xl font-extrabold text-[#0f172a]">
              Recently Viewed Lots
            </h2>
          </div>
          <Link
            href="/auctions"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#2563eb] hover:underline"
          >
            Explore all lots <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {items.map((lot) => (
            <Link
              key={lot.id}
              href={`/auctions/${lot.slug || lot.id}`}
              className="group block overflow-hidden rounded-xl border border-slate-200 bg-[#f8fafc] p-2.5 transition hover:-translate-y-1 hover:border-[#2563eb] hover:bg-white hover:shadow-md"
            >
              <div className="relative aspect-square overflow-hidden rounded-lg bg-slate-200 mb-2">
                <img
                  src={lot.imageUrl || "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80"}
                  alt={lot.title}
                  className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                />
              </div>
              <p className="text-xs font-bold text-[#0f172a] truncate group-hover:text-[#2563eb]">
                {lot.title}
              </p>
              <p className="text-xs font-extrabold text-[#2563eb] mt-1">
                {formatINR(lot.askingPrice || 0)}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <div className="min-h-screen bg-white text-[#0f172a] selection:bg-[#2563eb] selection:text-white">
      <Navbar />
      <main>
        <HeroSection />
        <TrustStrip />
        <RecentlyViewedSection />
        <FeaturedAuctions />
        <CategoriesSection />
        <HowItWorks />
        <SellerCTA />
        <WhyChoose />
        <Testimonials />
        <FAQSection />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}

export default HomePage;
