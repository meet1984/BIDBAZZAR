import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  FileText,
  Save,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import api from "../lib/api";
import { errorMessage } from "../lib/format";
import { EmptyState, ErrorState, LoadingState } from "../components";
import { VerificationStatusBanner } from "../components/VerificationStatusBanner";
import { DashboardLayout, DashboardSection } from "../dashboard/DashboardLayout";

const GOV_ID_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "national_id", label: "National ID (Aadhaar)" },
  { value: "voter_id", label: "Voter ID" },
  { value: "ssn_last4", label: "SSN (Last 4)" },
  { value: "tax_id", label: "Tax ID / PAN" },
  { value: "other", label: "Other" },
];

const DOC_TYPES = [
  { value: "government_id", label: "Government ID" },
  { value: "address_proof", label: "Address Proof" },
  { value: "tax_certificate", label: "GST / Tax Certificate (GSTIN)" },
  { value: "business_registration", label: "Business Registration" },
  { value: "other", label: "Other Document" },
];

const INITIAL_FORM = {
  legalFullName: "",
  dateOfBirth: "",
  buyerType: "individual",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pinCode: "",
  country: "India",
  governmentIdType: "",
  governmentIdNumber: "",
  businessName: "",
  gstNumber: "",
};

function InputField({ label, required, error, children }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {error && (
        <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </label>
  );
}

function inputClass(hasError) {
  return `w-full rounded-lg border ${hasError ? "border-red-300 ring-1 ring-red-200" : "border-slate-200"} bg-white px-3.5 py-2.5 text-sm text-[#0f172a] placeholder-slate-400 focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 transition-all outline-none`;
}

function selectClass(hasError) {
  return `w-full rounded-lg border ${hasError ? "border-red-300 ring-1 ring-red-200" : "border-slate-200"} bg-white px-3.5 py-2.5 text-sm text-[#0f172a] focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 transition-all outline-none appearance-none cursor-pointer`;
}

export default function BuyerProfilePage() {
  const [profile, setProfile] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Documents
  const [documents, setDocuments] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docType, setDocType] = useState("government_id");

  const [alert, setAlert] = useState(null);

  const isEditable =
    !verificationStatus ||
    verificationStatus === "profile_incomplete" ||
    verificationStatus === "draft" ||
    verificationStatus === "changes_requested" ||
    verificationStatus === "rejected";

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profileRes, statusRes, docsRes] = await Promise.allSettled([
        api.get("/buyer/profile"),
        api.get("/verification/status"),
        api.get("/verification/documents"),
      ]);

      if (profileRes.status === "fulfilled") {
        const p = profileRes.value.data.data || profileRes.value.data;
        setProfile(p);
        setForm({
          legalFullName: p.legalFullName || "",
          dateOfBirth: p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : "",
          buyerType: p.buyerType || "individual",
          addressLine1: p.addressLine1 || "",
          addressLine2: p.addressLine2 || "",
          city: p.city || "",
          state: p.state || "",
          pinCode: p.pinCode || "",
          country: p.country || "India",
          governmentIdType: p.governmentIdType || "",
          governmentIdNumber: p.maskedGovernmentIdRef || "",
          businessName: p.businessName || "",
          gstNumber: p.gstNumber || "",
        });
      }

      if (statusRes.status === "fulfilled") {
        const s = statusRes.value.data.data || statusRes.value.data;
        setVerificationStatus(s.verificationStatus);
      }

      if (docsRes.status === "fulfilled") {
        const d = docsRes.value.data.data || docsRes.value.data;
        setDocuments(Array.isArray(d) ? d : []);
      }
    } catch (err) {
      setError(errorMessage(err, "Failed to load profile details."));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    try {
      const [statusRes, docsRes] = await Promise.allSettled([
        api.get("/verification/status"),
        api.get("/verification/documents"),
      ]);

      if (statusRes.status === "fulfilled") {
        const s = statusRes.value.data.data || statusRes.value.data;
        setVerificationStatus(s.verificationStatus);
      }

      if (docsRes.status === "fulfilled") {
        const d = docsRes.value.data.data || docsRes.value.data;
        setDocuments(Array.isArray(d) ? d : []);
      }
    } catch {
      // Non-blocking document list update
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.legalFullName.trim() || form.legalFullName.trim().length < 2)
      e.legalFullName = "Legal full name is required (min 2 chars)";
    if (form.addressLine1 && form.addressLine1.trim().length < 5)
      e.addressLine1 = "Address must be at least 5 characters";
    if (form.pinCode && form.pinCode.trim().length < 3)
      e.pinCode = "PIN code must be at least 3 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      setAlert({
        type: "error",
        title: "Validation Error",
        message: "Please correct the highlighted fields before saving.",
      });
      return;
    }
    setSaving(true);
    setAlert(null);
    try {
      const payload = { ...form };
      // Convert empty strings to null for optional fields
      for (const key of Object.keys(payload)) {
        if (payload[key] === "") payload[key] = null;
      }
      // legalFullName is required, must not be null
      payload.legalFullName = form.legalFullName.trim();

      await api.patch("/buyer/profile", payload);
      setAlert({
        type: "success",
        title: "Profile Saved",
        message: "Your buyer profile details have been saved successfully.",
      });
      await loadProfile();
    } catch (err) {
      setAlert({
        type: "error",
        title: "Save Failed",
        message: errorMessage(err, "Failed to save profile changes."),
      });
    } finally {
      setSaving(false);
    }
  };

  const hasGovDoc = documents.some((d) => d.documentType === "government_id");
  const hasAddressDoc = documents.some((d) => d.documentType === "address_proof");
  const hasGstDoc = documents.some((d) => d.documentType === "tax_certificate" || d.documentType === "business_registration");
  const isBusinessBuyer = form.buyerType === "business";
  const hasGstNumber = Boolean(form.gstNumber?.trim());

  const checklistItems = [
    { label: "Legal Full Name", ok: Boolean(form.legalFullName?.trim()) },
    { label: "Date of Birth", ok: Boolean(form.dateOfBirth?.trim()) },
    { label: "Address Line 1", ok: Boolean(form.addressLine1?.trim()) },
    { label: "City", ok: Boolean(form.city?.trim()) },
    { label: "State", ok: Boolean(form.state?.trim()) },
    { label: "PIN Code", ok: Boolean(form.pinCode?.trim()) },
    { label: "Country", ok: Boolean(form.country?.trim()) },
    { label: "Government ID Details", ok: Boolean(form.governmentIdType?.trim()) && Boolean(form.governmentIdNumber?.trim()) },
    ...(isBusinessBuyer
      ? [
          { label: "Business Name", ok: Boolean(form.businessName?.trim()) },
          { label: "GST / Tax Number (GSTIN)", ok: hasGstNumber },
        ]
      : hasGstNumber
        ? [{ label: "GST / Tax Number (GSTIN)", ok: true }]
        : []),
    { label: "Government ID Document", ok: hasGovDoc },
    { label: "Address Proof Document", ok: hasAddressDoc },
    ...(hasGstNumber || isBusinessBuyer
      ? [{ label: "GST / Tax Certificate Document", ok: hasGstDoc }]
      : []),
  ];

  const handleSubmitVerification = async () => {
    setSubmitting(true);
    setAlert(null);
    try {
      if (validate()) {
        const payload = { ...form };
        for (const key of Object.keys(payload)) {
          if (payload[key] === "") payload[key] = null;
        }
        payload.legalFullName = form.legalFullName.trim();
        await api.patch("/buyer/profile", payload);
      }

      const missing = checklistItems.filter((item) => !item.ok).map((item) => item.label);
      if (missing.length > 0) {
        setAlert({
          type: "error",
          title: "Verification Requirements Incomplete",
          message: `Please complete all required fields and upload mandatory documents before submitting: ${missing.join(", ")}.`,
        });
        setSubmitting(false);
        return;
      }

      await api.post("/verification/submit");
      setAlert({
        type: "success",
        title: "Verification Submitted Successfully",
        message: "Your profile and documents have been submitted for review. Our compliance team will review your application shortly.",
      });
      await loadProfile();
    } catch (err) {
      setAlert({
        type: "error",
        title: "Submission Failed",
        message: errorMessage(err, "Failed to submit profile for verification."),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const [docError, setDocError] = useState("");

  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocError("");

    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      const msg = "Only JPEG, PNG, or PDF files are allowed.";
      setDocError(msg);
      setAlert({ type: "error", title: "Invalid Document Format", message: msg });
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      const msg = "File size must be under 5 MB.";
      setDocError(msg);
      setAlert({ type: "error", title: "File Too Large", message: msg });
      e.target.value = "";
      return;
    }

    setUploadingDoc(true);
    try {
      const fd = new FormData();
      fd.append("document", file);
      fd.append("documentType", docType);
      fd.append("originalName", file.name);
      fd.append("fileMime", file.type);
      fd.append("fileSize", String(file.size));

      await api.post("/verification/documents", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAlert({
        type: "success",
        title: "Document Uploaded",
        message: `"${file.name}" has been uploaded successfully.`,
      });
      await loadDocuments();
    } catch (err) {
      const msg = errorMessage(err, "Failed to upload document.");
      setDocError(msg);
      setAlert({ type: "error", title: "Upload Failed", message: msg });
    } finally {
      setUploadingDoc(false);
      e.target.value = "";
    }
  };

  const handleDeleteDoc = async (docId) => {
    if (!window.confirm("Delete this verification document?")) return;
    setDocError("");
    try {
      await api.delete(`/verification/documents/${docId}`);
      await loadDocuments();
      setAlert({
        type: "info",
        title: "Document Deleted",
        message: "Verification document has been removed.",
      });
    } catch (err) {
      const msg = errorMessage(err, "Failed to delete document.");
      setDocError(msg);
      setAlert({ type: "error", title: "Deletion Failed", message: msg });
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="buyer" title="Buyer Profile" description="Complete and manage your buyer verification profile.">
        <LoadingState label="Loading profile…" />
      </DashboardLayout>
    );
  }

  if (error && !profile) {
    return (
      <DashboardLayout role="buyer" title="Buyer Profile" description="Complete and manage your buyer verification profile.">
        <ErrorState message={error} onRetry={loadProfile} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role="buyer"
      title="Buyer Profile & Verification"
      description="Complete your profile, upload verification documents, and submit for review to start bidding."
    >
      {/* Verification Status Banner */}
      <VerificationStatusBanner
        status={verificationStatus || "profile_incomplete"}
        rejectionReason={profile?.rejectionReason}
        role="buyer"
        onSubmitVerification={handleSubmitVerification}
        submitting={submitting}
      />

      {/* Modern Interactive Alert Banner */}
      {alert && (
        <div
          className={`mb-6 rounded-xl border p-4 text-xs font-semibold flex items-start justify-between shadow-xs transition-all ${
            alert.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : alert.type === "info"
                ? "border-blue-200 bg-blue-50 text-blue-900"
                : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          <div className="flex items-start gap-3">
            {alert.type === "success" ? (
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            ) : alert.type === "info" ? (
              <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
            )}
            <div>
              {alert.title && <div className="font-extrabold text-sm mb-0.5">{alert.title}</div>}
              <div className="font-medium leading-relaxed">{alert.message}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAlert(null)}
            className="text-slate-400 hover:text-slate-700 ml-3 p-1 font-bold text-xs"
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        </div>
      )}

      {/* Verification Checklist */}
      {(verificationStatus === "profile_incomplete" || verificationStatus === "draft" || verificationStatus === "changes_requested") && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <h3 className="text-sm font-bold text-[#0f172a]">Verification Requirements Checklist</h3>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
              {checklistItems.filter((i) => i.ok).length} / {checklistItems.length} Complete
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {checklistItems.map((item) => (
              <div key={item.label} className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium ${item.ok ? "border-emerald-200 bg-emerald-50/50 text-emerald-800" : "border-amber-200 bg-amber-50/50 text-amber-900"}`}>
                {item.ok ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> : <AlertCircle size={15} className="text-amber-600 shrink-0" />}
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Personal Information */}
      <DashboardSection
        title="Personal Information"
        description="Your legal identity details used for verification."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <InputField label="Legal Full Name" required error={errors.legalFullName}>
            <input
              type="text"
              value={form.legalFullName}
              onChange={(e) => handleChange("legalFullName", e.target.value)}
              disabled={!isEditable}
              placeholder="As per government ID"
              className={inputClass(errors.legalFullName)}
            />
          </InputField>

          <InputField label="Date of Birth">
            <input
              type="date"
              value={form.dateOfBirth || ""}
              onChange={(e) => handleChange("dateOfBirth", e.target.value)}
              disabled={!isEditable}
              className={inputClass(false)}
            />
          </InputField>

          <InputField label="Buyer Type">
            <div className="relative">
              <select
                value={form.buyerType}
                onChange={(e) => handleChange("buyerType", e.target.value)}
                disabled={!isEditable}
                className={selectClass(false)}
              >
                <option value="individual">Individual</option>
                <option value="business">Business</option>
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </InputField>

          <InputField label="Government ID Type">
            <div className="relative">
              <select
                value={form.governmentIdType || ""}
                onChange={(e) => handleChange("governmentIdType", e.target.value)}
                disabled={!isEditable}
                className={selectClass(false)}
              >
                <option value="">Select ID type…</option>
                {GOV_ID_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </InputField>

          <InputField label="Government ID Number">
            <input
              type="text"
              value={form.governmentIdNumber || ""}
              onChange={(e) => handleChange("governmentIdNumber", e.target.value)}
              disabled={!isEditable}
              placeholder="Will be stored as masked reference"
              className={inputClass(false)}
            />
          </InputField>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2 pt-5 border-t border-slate-100">
          <InputField
            label={form.buyerType === "business" ? "Business Name" : "Business Name (Optional)"}
            required={form.buyerType === "business"}
            error={errors.businessName}
          >
            <input
              type="text"
              value={form.businessName || ""}
              onChange={(e) => handleChange("businessName", e.target.value)}
              disabled={!isEditable}
              placeholder="Registered business or enterprise name"
              className={inputClass(errors.businessName)}
            />
          </InputField>
          <InputField
            label={form.buyerType === "business" ? "GST / Tax Number (GSTIN)" : "GST / Tax Number (GSTIN, Optional)"}
            required={form.buyerType === "business"}
            error={errors.gstNumber}
          >
            <input
              type="text"
              value={form.gstNumber || ""}
              onChange={(e) => handleChange("gstNumber", e.target.value.toUpperCase())}
              disabled={!isEditable}
              placeholder="e.g. 22AAAAA0000A1Z5"
              className={inputClass(errors.gstNumber)}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Permanent GSTIN for B2B tax invoicing and verification.
            </p>
          </InputField>
        </div>
      </DashboardSection>

      {/* Address */}
      <DashboardSection
        title="Address Information"
        description="Your registered or current address for identity verification."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <InputField label="Address Line 1" error={errors.addressLine1}>
              <input
                type="text"
                value={form.addressLine1 || ""}
                onChange={(e) => handleChange("addressLine1", e.target.value)}
                disabled={!isEditable}
                placeholder="Street address, building name"
                className={inputClass(errors.addressLine1)}
              />
            </InputField>
          </div>
          <div className="sm:col-span-2">
            <InputField label="Address Line 2">
              <input
                type="text"
                value={form.addressLine2 || ""}
                onChange={(e) => handleChange("addressLine2", e.target.value)}
                disabled={!isEditable}
                placeholder="Apartment, suite, floor (optional)"
                className={inputClass(false)}
              />
            </InputField>
          </div>

          <InputField label="City">
            <input
              type="text"
              value={form.city || ""}
              onChange={(e) => handleChange("city", e.target.value)}
              disabled={!isEditable}
              placeholder="City"
              className={inputClass(false)}
            />
          </InputField>

          <InputField label="State / Province">
            <input
              type="text"
              value={form.state || ""}
              onChange={(e) => handleChange("state", e.target.value)}
              disabled={!isEditable}
              placeholder="State"
              className={inputClass(false)}
            />
          </InputField>

          <InputField label="PIN / ZIP Code" error={errors.pinCode}>
            <input
              type="text"
              value={form.pinCode || ""}
              onChange={(e) => handleChange("pinCode", e.target.value)}
              disabled={!isEditable}
              placeholder="e.g. 400001"
              className={inputClass(errors.pinCode)}
            />
          </InputField>

          <InputField label="Country">
            <input
              type="text"
              value={form.country || "India"}
              onChange={(e) => handleChange("country", e.target.value)}
              disabled={!isEditable}
              placeholder="Country"
              className={inputClass(false)}
            />
          </InputField>
        </div>
      </DashboardSection>

      {/* Verification Documents */}
      <DashboardSection
        title="Verification Documents"
        description="Upload supporting documents (Government ID, Address Proof, GST / Tax Certificate). Accepted formats: JPEG, PNG, PDF (max 5 MB each)."
      >
        {/* Existing docs */}
        {documents.length > 0 ? (
          <div className="divide-y divide-slate-100 mb-5">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-[#2563eb]">
                    <FileText size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0f172a] truncate">
                      {doc.originalName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {doc.documentType?.replace(/_/g, " ")} ·{" "}
                      {(doc.fileSize / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                {isEditable && (
                  <button
                    type="button"
                    onClick={() => handleDeleteDoc(doc.id)}
                    className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    aria-label="Delete document"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No documents uploaded"
            description="Upload at least one government ID to complete verification."
          />
        )}

        {/* Upload area */}
        {docError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 font-semibold flex items-center justify-between">
            <span>{docError}</span>
            <button type="button" onClick={() => setDocError("")} className="font-bold text-red-500 hover:text-red-800 ml-2">✕</button>
          </div>
        )}
        {isEditable && (
          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-700">Document Type</label>
              <div className="relative mt-1.5">
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className={selectClass(false)}
                >
                  {DOC_TYPES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>
            <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f172a] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#2563eb] transition-colors shadow-sm cursor-pointer self-end">
              <Upload size={14} />
              {uploadingDoc ? "Uploading…" : "Upload File"}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleDocUpload}
                disabled={uploadingDoc}
                className="sr-only"
              />
            </label>
          </div>
        )}
      </DashboardSection>

      {/* Save / Submit Actions */}
      {isEditable && (
        <div className="flex flex-wrap items-center gap-3 mt-2 mb-8">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563eb] px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? "Saving…" : "Save Profile"}
          </button>

          {(verificationStatus === "draft" || verificationStatus === "changes_requested" || verificationStatus === "rejected") && (
            <button
              type="button"
              onClick={handleSubmitVerification}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0f172a] px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-60"
            >
              <Send size={16} />
              {submitting ? "Submitting…" : "Submit for Verification"}
            </button>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
