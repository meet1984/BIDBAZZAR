import React, { useState } from "react";
import Link from "./Link";
import Brand from "./Brand";
import api from "../lib/api";
import { errorMessage } from "../lib/format";

const FOOTER_GROUPS = [
  [
    "Marketplace",
    [
      ["All Auctions", "/auctions"],
      ["How It Works", "/how-it-works"],
      ["Support", "/support"],
    ],
  ],
  [
    "For Sellers",
    [
      ["List an Item", "/seller/register"],
      ["Seller Login", "/login"],
      ["Seller Guide", "/how-it-works"],
    ],
  ],
  [
    "Support",
    [
      ["Help Centre", "/support"],
      ["Contact", "/support"],
      ["Auction Rules", "/how-it-works"],
    ],
  ],
  [
    "Company",
    [
      ["About", "/about"],
      ["Terms", "/terms"],
      ["Privacy", "/privacy"],
    ],
  ],
];

export function Footer() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const subscribe = async (event) => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setMessage("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post("/newsletter/subscriptions", {
        email: email.trim().toLowerCase(),
      });
      setMessage(data.message);
      setEmail("");
    } catch (error) {
      setMessage(errorMessage(error, "We could not save your subscription."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="bg-[#0f172a] px-5 pb-7 pt-16 text-white md:px-[5vw]">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-12 border-b border-slate-700/70 pb-12 lg:grid-cols-[0.8fr_1.6fr]">
          <div>
            <Brand className="h-14 md:h-16 bg-white p-2 rounded-lg shadow-sm" />
            <p className="mt-4 max-w-sm text-xs leading-6 text-slate-400">
              A considered marketplace for discovering, listing and
              participating in online auctions.
            </p>
            <p className="mt-2 text-[10px] text-slate-500">
              New Delhi, India · support@bidmylot.com
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {FOOTER_GROUPS.map(([heading, links]) => (
              <div key={heading}>
                <h2 className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-slate-400">
                  {heading}
                </h2>
                <div className="mt-4 space-y-3">
                  {links.map(([label, href]) => (
                    <Link
                      key={label}
                      href={href}
                      className="block text-xs text-slate-300 hover:text-white"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-8 border-b border-slate-700/50 py-8 md:flex-row md:items-end">
          <div className="max-w-xl">
            <h3 className="text-xs font-bold">
              Auction updates, without the noise.
            </h3>
            <p className="mt-2 text-[10px] text-slate-400">
              Receive news about reviewed listings and important marketplace
              updates.
            </p>
            <form onSubmit={subscribe} noValidate className="mt-4 flex">
              <label htmlFor="footer-newsletter" className="sr-only">
                Email address
              </label>
              <input
                id="footer-newsletter"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Your email address"
                className="min-w-0 flex-1 rounded-l-[3px] border border-slate-600 bg-[#1e293b] px-3 text-xs outline-none placeholder:text-slate-500 focus:border-[#2563eb]"
              />
              <button
                type="submit"
                disabled={submitting}
                className="min-h-11 rounded-r-[3px] bg-[#2563eb] px-4 text-xs font-bold transition hover:bg-[#1d4ed8]"
              >
                {submitting ? "Saving…" : "Subscribe"}
              </button>
            </form>
            <p
              className="mt-2 min-h-4 text-[9px] text-slate-400"
              aria-live="polite"
            >
              {message}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-6 text-[10px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 bidmylot. All rights reserved.</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-4">
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
