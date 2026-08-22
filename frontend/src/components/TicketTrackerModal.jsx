import React from "react";
import {
  X,
  CheckCircle2,
  Clock,
  FileText,
} from "lucide-react";
import { formatDateTime } from "../lib/format";

export function TicketTrackerModal({ ticket, isOpen, onClose }) {
  if (!isOpen || !ticket) return null;

  // Determine progress steps
  const steps = [
    {
      title: "Complaint Lodged",
      desc: "Received by server",
      state: "completed",
    },
    {
      title: "Admin Review",
      desc: ticket.status === "open" ? "Pending review" : ticket.status === "in_progress" ? "Currently in progress" : "Review completed",
      state: ticket.status === "open" ? "current" : "completed",
    },
    {
      title: "Resolution",
      desc: ticket.status === "resolved" ? "Issue resolved" : ticket.status === "closed" ? "Ticket closed" : "Pending resolution",
      state: ticket.status === "resolved" || ticket.status === "closed" ? "completed" : "upcoming",
    },
  ];

  const statusConfig = {
    open: {
      label: "Open / Queued",
      bg: "bg-blue-50 border-blue-200 text-[#2563eb]",
      icon: Clock,
      alertMsg: "Your complaint has been successfully lodged and is in the queue for administrator review.",
    },
    in_progress: {
      label: "Under Active Review",
      bg: "bg-amber-50 border-amber-200 text-amber-800",
      icon: Clock,
      alertMsg: "An administrator is currently reviewing your ticket and investigating the issue.",
    },
    resolved: {
      label: "Resolved",
      bg: "bg-emerald-50 border-emerald-200 text-emerald-800",
      icon: CheckCircle2,
      alertMsg: "This ticket has been marked as resolved by the bidmylot admin team.",
    },
    closed: {
      label: "Closed",
      bg: "bg-slate-100 border-slate-200 text-slate-700",
      icon: CheckCircle2,
      alertMsg: "This support inquiry/complaint ticket has been closed.",
    },
  };

  const currentStatus = statusConfig[ticket.status] || statusConfig.open;
  const StatusIcon = currentStatus.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl my-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-6 sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-[#2563eb]">
                {ticket.reference}
              </span>
              <span className="rounded bg-slate-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-slate-600">
                {ticket.role} ticket
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#0f172a] mt-1">
              {ticket.subject}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Lodged on {formatDateTime(ticket.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Status Alert Banner */}
        <div className={`rounded-xl border p-4 flex items-start gap-3 text-xs ${currentStatus.bg}`}>
          <StatusIcon size={18} className="mt-0.5 shrink-0" />
          <div>
            <span className="font-extrabold uppercase text-[10px] block">
              Status: {currentStatus.label}
            </span>
            <p className="mt-0.5 leading-relaxed font-medium">
              {currentStatus.alertMsg}
            </p>
          </div>
        </div>

        {/* Progress Tracker Stepper */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Resolution Progress Tracker
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {steps.map((st, idx) => (
              <div
                key={st.title}
                className={`rounded-xl border p-3 text-center transition-all ${st.state === "completed"
                    ? "border-emerald-200 bg-emerald-50/60 text-emerald-900"
                    : st.state === "current"
                      ? "border-blue-300 bg-blue-50/70 text-[#2563eb] ring-2 ring-blue-500/20"
                      : "border-slate-200 bg-slate-50/50 text-slate-400"
                  }`}
              >
                <div className="mx-auto grid h-7 w-7 place-items-center rounded-full bg-white text-xs font-black shadow-xs mb-2">
                  {st.state === "completed" ? "✓" : idx + 1}
                </div>
                <p className="text-xs font-bold leading-tight">{st.title}</p>
                <p className="text-[10px] mt-0.5 opacity-80">{st.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Metadata Grid */}
        <div className="grid gap-3 sm:grid-cols-2 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs">
          <div>
            <span className="font-bold text-slate-400 uppercase text-[10px] block">Category / Reason</span>
            <p className="font-extrabold text-[#0f172a] mt-0.5 capitalize">{ticket.reason.replace("-", " ")}</p>
          </div>
          <div>
            <span className="font-bold text-slate-400 uppercase text-[10px] block">Contact Email</span>
            <p className="font-extrabold text-slate-800 mt-0.5">{ticket.email}</p>
          </div>
          {ticket.auctionReference && (
            <div className="sm:col-span-2">
              <span className="font-bold text-slate-400 uppercase text-[10px] block">Related Auction Reference</span>
              <p className="font-mono font-bold text-[#2563eb] mt-0.5">{ticket.auctionReference}</p>
            </div>
          )}
        </div>

        {/* Attachment if any */}
        {ticket.attachment && (
          <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FileText size={18} className="text-[#2563eb]" />
              <span className="text-xs font-bold text-slate-800">{ticket.attachment.name}</span>
            </div>
            <span className="text-[10px] font-extrabold uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
              Attached File
            </span>
          </div>
        )}

        {/* Complaint Message Body */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Lodged Complaint / Message Detail
          </h4>
          <div className="rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap border border-slate-200/70 max-h-48 overflow-y-auto">
            {ticket.message || "No message detail provided."}
          </div>
        </div>

        {/* Footer Close Button */}
        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#0f172a] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#2563eb] transition-colors"
          >
            Close Tracker
          </button>
        </div>
      </div>
    </div>
  );
}
