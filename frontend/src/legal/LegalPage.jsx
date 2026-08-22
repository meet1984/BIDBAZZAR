import React from "react";
import { Footer, Navbar } from "../components";

const content = {
  terms: ["Use accurate account and listing information.", "Offers are private between the buyer, seller and authorized marketplace staff.", "A confirmed offer or allocation creates a direct agreement between buyer and seller.", "BidMyLot does not process payment, delivery, or collection.", "Fraud, manipulation, self-offering and unauthorized access are prohibited.", "Dispute and review actions must reflect the real transaction."],
  privacy: ["BidMyLot processes account, verification, listing, offer and order data to operate the marketplace.", "Identity and support documents are private and available only through authenticated, authorized endpoints.", "Public profiles exclude private offer terms, identity documents and contact details.", "Contact details are shared only with the confirmed deal parties and authorized administrators.", "Operational records are retained where needed for security, disputes and legal compliance.", "Contact support to request an applicable data-access or correction action."],
};

export default function LegalPage({ type }) {
  const title = type === "privacy" ? "Privacy notice" : "Marketplace terms";
  return <><Navbar/><main className="mx-auto min-h-[65vh] max-w-4xl px-5 py-16"><p className="text-xs font-bold uppercase tracking-widest text-blue-600">BidMyLot policy</p><h1 className="mt-3 text-4xl font-bold">{title}</h1><p className="mt-4 text-sm leading-6 text-slate-600">This product copy is a practical marketplace summary and should be reviewed by qualified counsel before production launch.</p><ol className="mt-8 space-y-4">{content[type].map((item,index)=><li key={item} className="rounded border border-slate-200 bg-white p-5 text-sm leading-6"><span className="mr-3 font-bold text-blue-600">{index+1}.</span>{item}</li>)}</ol></main><Footer/></>;
}
