import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileWarning,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Link } from "./Link";

const STATUS_CONFIG = {
  profile_incomplete: {
    icon: AlertCircle,
    bg: "bg-amber-50 border-amber-200",
    iconColor: "text-amber-500",
    title: "Profile Incomplete",
    description:
      "Your profile is not yet fully completed. Complete all required fields and upload verification documents to submit.",
    action: { label: "Submit for Verification", type: "submit" },
  },
  draft: {
    icon: FileWarning,
    bg: "bg-slate-50 border-slate-200",
    iconColor: "text-slate-500",
    title: "Profile Draft",
    description:
      "Your profile has been saved but not submitted for verification. Submit it to start the review process.",
    action: { label: "Submit for Review", type: "submit" },
  },
  submitted: {
    icon: Clock,
    bg: "bg-blue-50 border-blue-200",
    iconColor: "text-blue-500",
    title: "Verification Submitted",
    description:
      "Your profile is in the verification queue. An admin will review it shortly. You cannot edit your profile while it's under review.",
    action: null,
  },
  under_review: {
    icon: Clock,
    bg: "bg-blue-50 border-blue-200",
    iconColor: "text-blue-500",
    title: "Under Review",
    description:
      "An admin is currently reviewing your verification documents and profile. This usually takes 1–3 business days.",
    action: null,
  },
  verified: {
    icon: ShieldCheck,
    bg: "bg-emerald-50 border-emerald-200",
    iconColor: "text-emerald-600",
    title: "Verified",
    description:
      "Your profile is verified and you can fully participate in the marketplace.",
    action: null,
  },
  changes_requested: {
    icon: XCircle,
    bg: "bg-purple-50 border-purple-200",
    iconColor: "text-purple-600",
    title: "Changes Requested",
    description: null, // dynamically set with rejection reason
    action: { label: "Update Profile", href: null },
  },
  rejected: {
    icon: XCircle,
    bg: "bg-red-50 border-red-200",
    iconColor: "text-red-600",
    title: "Verification Rejected",
    description: null,
    action: { label: "Update & Resubmit", href: null },
  },
  suspended: {
    icon: ShieldAlert,
    bg: "bg-red-50 border-red-300",
    iconColor: "text-red-700",
    title: "Account Suspended",
    description:
      "Your account has been suspended. Contact support for further details.",
    action: { label: "Contact Support", href: "/contact" },
  },
};

/**
 * VerificationStatusBanner
 *
 * @param {object} props
 * @param {string} props.status — one of the verification statuses
 * @param {string|null} [props.rejectionReason]
 * @param {string} [props.role] — "buyer" | "seller"
 * @param {function} [props.onSubmitVerification] — callback to submit for verification
 * @param {boolean} [props.submitting]
 */
export function VerificationStatusBanner({
  status,
  rejectionReason,
  role = "buyer",
  onSubmitVerification,
  submitting = false,
}) {
  const config = STATUS_CONFIG[status];
  if (!config) return null;

  // Don't render on verified unless explicitly called
  if (status === "verified") {
    return (
      <div className={`flex items-center gap-3 rounded-xl border px-5 py-4 mb-6 ${config.bg}`}>
        <CheckCircle2 size={20} className={config.iconColor} />
        <div>
          <p className="text-sm font-bold text-emerald-800">{config.title}</p>
          <p className="text-xs text-emerald-700 mt-0.5">{config.description}</p>
        </div>
      </div>
    );
  }

  const Icon = config.icon;
  const dynamicDescription =
    status === "changes_requested" || status === "rejected"
      ? rejectionReason
        ? `${config.title}: ${rejectionReason}`
        : `Your profile requires updates before it can be approved.`
      : config.description;

  const profileHref =
    role === "seller" ? "/seller/profile" : "/buyer/profile";

  return (
    <div className={`rounded-xl border px-5 py-5 mb-6 ${config.bg}`}>
      <div className="flex items-start gap-3">
        <Icon size={22} className={`mt-0.5 shrink-0 ${config.iconColor}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-[#0f172a]">{config.title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {dynamicDescription}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {/* Submit for review button */}
            {config.action?.type === "submit" && onSubmitVerification && (
              <button
                type="button"
                onClick={onSubmitVerification}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit for Verification"}
              </button>
            )}

            {/* Navigate to profile page */}
            {config.action?.href === null &&
              config.action?.type !== "submit" && (
                <Link
                  href={profileHref}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f172a] px-4 py-2 text-xs font-bold text-white hover:bg-[#2563eb] transition-colors shadow-sm"
                >
                  {config.action.label}
                </Link>
              )}

            {/* Fixed href (e.g., contact support) */}
            {config.action?.href && config.action.href !== null && (
              <Link
                href={config.action.href}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#0f172a] hover:bg-slate-50 transition-colors shadow-sm"
              >
                {config.action.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
