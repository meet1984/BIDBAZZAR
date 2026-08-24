import React, { useState, useRef } from "react";
import {
  X,
  AlertCircle,
  CheckCircle2,
  Paperclip,
  Send,
  LoaderCircle,
  LifeBuoy,
  ShieldAlert,
} from "lucide-react";
import api from "../lib/api";
import { errorMessage } from "../lib/format";

const REASON_OPTIONS = [
  { value: "auction-dispute", label: "Auction Dispute / Bidding Issue", icon: "⚖️" },
  { value: "seller-complaint", label: "Complaint against Seller", icon: "🏪" },
  { value: "buyer-complaint", label: "Complaint against Buyer", icon: "👤" },
  { value: "direct-deal", label: "Confirmed Deal Issue", icon: "🤝" },
  { value: "buyer-account", label: "Buyer Account Assistance", icon: "🔐" },
  { value: "seller-account", label: "Seller Account / Verification", icon: "🏷️" },
  { value: "listing-submission", label: "Listing Submission Issue", icon: "📝" },
  { value: "listing-review", label: "Listing Moderation Review", icon: "🔍" },
  { value: "technical", label: "Technical Glitch / Bug", icon: "💻" },
  { value: "general", label: "General Support & Inquiry", icon: "💬" },
];

export function SupportComplaintModal({
  isOpen,
  onClose,
  onSuccess,
  user,
  role = "buyer",
  userAuctions = [],
}) {
  const [formData, setFormData] = useState({
    fullName: user?.fullName || "",
    email: user?.email || "",
    phone: "",
    role: role,
    reason: role === "seller" ? "seller-complaint" : "auction-dispute",
    subject: "",
    reference: "",
    customReference: "",
    message: "",
    consent: true,
  });

  const [attachment, setAttachment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submittedRef, setSubmittedRef] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      setError("Please choose a JPG, PNG, or PDF file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Attachment file size must be less than 5 MB.");
      return;
    }
    setError("");
    setAttachment(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim()) return setError("Full name is required.");
    if (!formData.email.trim()) return setError("Email address is required.");
    if (!formData.phone.trim()) return setError("Phone number is required.");
    if (formData.phone.trim().length < 7 || formData.phone.trim().length > 30) {
      return setError("Please enter a valid phone number (7-30 digits).");
    }
    if (!formData.subject.trim() || formData.subject.trim().length < 4) {
      return setError("Subject must be at least 4 characters.");
    }
    if (!formData.message.trim() || formData.message.trim().length < 20) {
      return setError("Please describe your issue in at least 20 characters.");
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = new FormData();
      payload.append("fullName", formData.fullName.trim());
      payload.append("email", formData.email.trim());
      payload.append("phone", formData.phone.trim());
      payload.append("role", formData.role);
      payload.append("reason", formData.reason);
      payload.append("subject", formData.subject.trim());

      const finalRef = formData.reference === "custom"
        ? formData.customReference.trim()
        : formData.reference;
      if (finalRef) payload.append("reference", finalRef);

      payload.append("message", formData.message.trim());
      payload.append("consent", "true");

      if (attachment) {
        payload.append("attachment", attachment);
      }

      const { data } = await api.post("/support/enquiries", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSubmittedRef(data.reference);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(errorMessage(err, "Failed to submit complaint. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl my-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[#2563eb]">
              <LifeBuoy size={20} />
            </span>
            <div>
              <h2 className="text-xl font-bold text-[#0f172a]">
                {role === "seller" ? "Lodge Seller Complaint & Support" : "Lodge Buyer Complaint & Support"}
              </h2>
              <p className="text-xs text-slate-500">
                Submit an official complaint or query to the bidmylot admin team.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Success View */}
        {submittedRef ? (
          <div className="py-6 text-center space-y-4">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-2xl font-black text-[#0f172a]">Complaint Lodged Successfully</h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Your ticket reference number is:
            </p>
            <div className="inline-block rounded-xl border border-blue-200 bg-blue-50 px-5 py-2.5 font-mono text-lg font-black text-[#2563eb]">
              {submittedRef}
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Our admin team will review your complaint and respond shortly. You can track this ticket directly from your dashboard.
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-[#0f172a] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#2563eb] transition-colors"
              >
                Close Window
              </button>
            </div>
          </div>
        ) : (
          /* Complaint Form */
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Category / Reason Selection */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Complaint / Category Reason <span className="text-blue-600">*</span>
              </label>
              <select
                value={formData.reason}
                onChange={(e) => handleFieldChange("reason", e.target.value)}
                className="w-full h-11 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-500/10"
              >
                {REASON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Subject / Title <span className="text-blue-600">*</span>
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => handleFieldChange("subject", e.target.value)}
                placeholder="Brief summary of your complaint or query..."
                className="w-full h-11 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-500/10"
              />
            </div>

            {/* User Info Grid */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Your Name <span className="text-blue-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => handleFieldChange("fullName", e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-[#2563eb]"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Your Email <span className="text-blue-600">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => handleFieldChange("email", e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-[#2563eb]"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Your Phone <span className="text-blue-600">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+1 555-123-4567"
                  value={formData.phone}
                  onChange={(e) => handleFieldChange("phone", e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-[#2563eb]"
                />
              </div>
            </div>

            {/* Related Auction Reference */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Related Auction Reference (Optional)
              </label>
              {userAuctions && userAuctions.length > 0 ? (
                <div className="space-y-2">
                  <select
                    value={formData.reference}
                    onChange={(e) => handleFieldChange("reference", e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-[#2563eb]"
                  >
                    <option value="">None / General Complaint</option>
                    {userAuctions.map((auc) => (
                      <option key={auc.id} value={auc.lotNumber || auc.slug || `AUC-${auc.id}`}>
                        Lot #{auc.lotNumber || auc.id} - {auc.title}
                      </option>
                    ))}
                    <option value="custom">Other / Type manual reference...</option>
                  </select>

                  {formData.reference === "custom" && (
                    <input
                      type="text"
                      value={formData.customReference}
                      onChange={(e) => handleFieldChange("customReference", e.target.value)}
                      placeholder="Enter auction lot number, slug or ID..."
                      className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-[#2563eb]"
                    />
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  value={formData.reference}
                  onChange={(e) => handleFieldChange("reference", e.target.value)}
                  placeholder="e.g. Lot #1002 or auction title reference..."
                  className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-[#2563eb]"
                />
              )}
            </div>

            {/* Detailed Complaint Message */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Detailed Message / Explanation <span className="text-blue-600">*</span>
              </label>
              <textarea
                rows={5}
                value={formData.message}
                onChange={(e) => handleFieldChange("message", e.target.value)}
                placeholder="Explain clearly what happened, including dates, auction titles, or relevant details..."
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-500/10 leading-relaxed"
              />
              <p className="mt-1 text-[10px] text-slate-400 text-right">
                {formData.message.length}/1500 characters
              </p>
            </div>

            {/* File Attachment */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Attach Supporting Document / Proof (Optional)
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <Paperclip size={14} />
                  {attachment ? "Change File" : "Choose File (JPG, PNG, PDF)"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {attachment && (
                  <span className="text-xs font-bold text-emerald-700 truncate max-w-[200px]">
                    ✓ {attachment.name}
                  </span>
                )}
              </div>
            </div>

            {/* Disclaimer */}
            <div className="rounded-lg bg-blue-50/70 p-3 border border-blue-100 flex items-start gap-2 text-[11px] text-slate-600">
              <ShieldAlert size={15} className="text-blue-600 shrink-0 mt-0.5" />
              <span>
                Please ensure all provided details are accurate. Administrators will review your submission and log all interactions.
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0f172a] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#2563eb] transition-colors shadow-sm disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <LoaderCircle size={15} className="animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <Send size={15} /> Submit Complaint
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
