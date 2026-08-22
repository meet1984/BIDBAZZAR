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

const DOC_TYPES = [
  { value: "government_id", label: "Government ID" },
  { value: "address_proof", label: "Address Proof" },
  { value: "tax_certificate", label: "GST / Tax Certificate (GSTIN)" },
  { value: "business_registration", label: "Business Registration" },
  { value: "other", label: "Other Document" },
];

const PRODUCT_CATEGORY_OPTIONS = [
  "Electronics",
  "Furniture",
  "Machinery",
  "Vehicles",
  "Textiles",
  "Real Estate",
  "Collectibles",
  "Art",
  "Jewelry",
  "Other",
];

const INITIAL_FORM = {
  legalName: "",
  businessName: "",
  sellerType: "individual",
  registeredAddressLine1: "",
  registeredAddressLine2: "",
  city: "",
  state: "",
  pinCode: "",
  country: "India",
  panGstNumber: "",
  businessRegistrationInfo: "",
  productCategories: [],
  publicBusinessDescription: "",
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
  return `w-full rounded-lg border ${hasError ? "border-red-300 ring-1 ring-red-200" : "border-slate-200"} bg-white px-3.5 py-2.5 text-sm text-[#0f172a] placeholder:text-slate-400 focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 transition-all outline-none`;
}

function selectClass(hasError) {
  return `w-full rounded-lg border ${hasError ? "border-red-300 ring-1 ring-red-200" : "border-slate-200"} bg-white px-3.5 py-2.5 text-sm text-[#0f172a] focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 transition-all outline-none appearance-none cursor-pointer`;
}

function textareaClass(hasError) {
  return `w-full rounded-lg border ${hasError ? "border-red-300 ring-1 ring-red-200" : "border-slate-200"} bg-white px-3.5 py-2.5 text-sm text-[#0f172a] placeholder:text-slate-400 focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 transition-all outline-none resize-y min-h-[80px]`;
}

export default function SellerProfilePage() {
  const [profile, setProfile] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Documents
  const [documents, setDocuments] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docType, setDocType] = useState("business_registration");

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
        api.get("/seller/profile"),
        api.get("/verification/status"),
        api.get("/verification/documents"),
      ]);

      if (profileRes.status === "fulfilled") {
        const data = profileRes.value.data.data || profileRes.value.data;
        setProfile(data);
        setForm({
          legalName: data.legalName || user?.fullName || "",
          businessName: data.businessName || "",
          sellerType: data.sellerType || "individual",
          registeredAddressLine1: data.registeredAddressLine1 || "",
          registeredAddressLine2: data.registeredAddressLine2 || "",
          city: data.city || "",
          state: data.state || "",
          pinCode: data.pinCode || "",
          country: data.country || "India",
          panGstNumber: data.panGstRef || "",
          businessRegistrationInfo: data.businessRegistrationInfo || "",
          productCategories: data.productCategories || [],
          publicBusinessDescription: data.publicBusinessDescription || "",
        });
      }

      if (statusRes.status === "fulfilled") {
        const vs = statusRes.value.data.data || statusRes.value.data;
        setVerificationStatus(vs.verificationStatus);
      }

      if (docsRes.status === "fulfilled") {
        setDocuments(docsRes.value.data.data || []);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setSaveSuccess(false);
  };

  const toggleCategory = (cat) => {
    setForm((f) => {
      const current = f.productCategories || [];
      const next = current.includes(cat)
        ? current.filter((c) => c !== cat)
        : [...current, cat];
      return { ...f, productCategories: next };
    });
    setSaveSuccess(false);
  };

  const validate = () => {
    const e = {};
    if (!form.legalName.trim() || form.legalName.trim().length < 2)
      e.legalName = "Legal name is required (min 2 chars)";
    if (!form.businessName.trim() || form.businessName.trim().length < 2)
      e.businessName = "Business name is required (min 2 chars)";
    if (form.registeredAddressLine1 && form.registeredAddressLine1.trim().length < 5)
      e.registeredAddressLine1 = "Address must be at least 5 characters";
    if (form.pinCode && form.pinCode.trim().length < 3)
      e.pinCode = "PIN code must be at least 3 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const payload = { ...form };
      for (const key of Object.keys(payload)) {
        if (payload[key] === "" && key !== "legalName" && key !== "businessName")
          payload[key] = null;
      }
      payload.legalName = form.legalName.trim();
      payload.businessName = form.businessName.trim();
      if (
        payload.productCategories &&
        Array.isArray(payload.productCategories) &&
        payload.productCategories.length === 0
      )
        payload.productCategories = null;

      await api.patch("/seller/profile", payload);
      setSaveSuccess(true);
      await loadProfile();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const hasGovDoc = documents.some((d) => d.documentType === "government_id");
  const hasAddressDoc = documents.some((d) => d.documentType === "address_proof");
  const hasBusinessDoc = documents.some((d) => d.documentType === "business_registration" || d.documentType === "tax_certificate");
  const hasGstDoc = documents.some((d) => d.documentType === "tax_certificate" || d.documentType === "business_registration");
  const isNonIndividual = form.sellerType !== "individual";

  const checklistItems = [
    { label: "Legal Name", ok: Boolean(form.legalName?.trim()) },
    { label: "Business Name", ok: Boolean(form.businessName?.trim()) },
    { label: "Registered Address Line 1", ok: Boolean(form.registeredAddressLine1?.trim()) },
    { label: "City", ok: Boolean(form.city?.trim()) },
    { label: "State", ok: Boolean(form.state?.trim()) },
    { label: "PIN Code", ok: Boolean(form.pinCode?.trim()) },
    { label: "Country", ok: Boolean(form.country?.trim()) },
    { label: "PAN / GST Number (GSTIN)", ok: Boolean(form.panGstNumber?.trim()) },
    ...(isNonIndividual
      ? [{ label: "Business Registration Info", ok: Boolean(form.businessRegistrationInfo?.trim()) }]
      : []),
    { label: "Government ID Document", ok: hasGovDoc },
    { label: "Address Proof Document", ok: hasAddressDoc },
    ...(isNonIndividual
      ? [{ label: "Business / GST Registration Document", ok: hasBusinessDoc }]
      : Boolean(form.panGstNumber?.trim())
        ? [{ label: "GST / Tax Certificate Document", ok: hasGstDoc }]
        : []),
  ];

  const handleSubmitVerification = async () => {
    setSubmitting(true);
    setError("");
    try {
      if (validate()) {
        const payload = { ...form };
        for (const key of Object.keys(payload)) {
          if (payload[key] === "" && key !== "legalName" && key !== "businessName")
            payload[key] = null;
        }
        payload.legalName = form.legalName.trim();
        payload.businessName = form.businessName.trim();
        if (
          payload.productCategories &&
          Array.isArray(payload.productCategories) &&
          payload.productCategories.length === 0
        )
          payload.productCategories = null;

        await api.patch("/seller/profile", payload);
      }

      const missing = checklistItems.filter((item) => !item.ok).map((item) => item.label);
      if (missing.length > 0) {
        setError(`Complete all required fields and documents before submitting: ${missing.join(", ")}.`);
        setSubmitting(false);
        return;
      }

      await api.post("/verification/submit");
      await loadProfile();
    } catch (err) {
      setError(errorMessage(err, "Failed to submit business profile for verification."));
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
      setDocError("Only JPEG, PNG, or PDF files are allowed.");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setDocError("File size must be under 5 MB.");
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
      await loadProfile();
    } catch (err) {
      setDocError(errorMessage(err, "Failed to upload document."));
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
      setDocuments((d) => d.filter((doc) => doc.id !== docId));
    } catch (err) {
      setDocError(errorMessage(err));
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="seller" title="Business Profile" description="Complete and manage your seller verification profile.">
        <LoadingState label="Loading business profile…" />
      </DashboardLayout>
    );
  }

  if (error && !profile) {
    return (
      <DashboardLayout role="seller" title="Business Profile" description="Complete and manage your seller verification profile.">
        <ErrorState message={error} onRetry={loadProfile} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role="seller"
      title="Business Profile & Verification"
      description="Complete your business profile, upload registration documents, and submit for verification to start listing auctions."
    >
      {/* Verification Status Banner */}
      <VerificationStatusBanner
        status={verificationStatus || "profile_incomplete"}
        rejectionReason={profile?.rejectionReason}
        role="seller"
        onSubmitVerification={handleSubmitVerification}
        submitting={submitting}
      />

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

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {saveSuccess && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700 flex items-center gap-2">
          <CheckCircle2 size={14} /> Business profile saved successfully.
        </div>
      )}

      {/* Business Identity */}
      <DashboardSection
        title="Business Identity"
        description="Your legal business identity for verification and public listing."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <InputField label="Legal Name" required error={errors.legalName}>
            <input
              type="text"
              value={form.legalName}
              onChange={(e) => handleChange("legalName", e.target.value)}
              disabled={!isEditable}
              placeholder="Legal business or individual name"
              className={inputClass(errors.legalName)}
            />
          </InputField>

          <InputField label="Business / Brand Name" required error={errors.businessName}>
            <input
              type="text"
              value={form.businessName}
              onChange={(e) => handleChange("businessName", e.target.value)}
              disabled={!isEditable}
              placeholder="Your public-facing brand name"
              className={inputClass(errors.businessName)}
            />
          </InputField>

          <InputField label="Seller Type">
            <div className="relative">
              <select
                value={form.sellerType}
                onChange={(e) => handleChange("sellerType", e.target.value)}
                disabled={!isEditable}
                className={selectClass(false)}
              >
                <option value="individual">Individual Seller</option>
                <option value="business">Registered Business</option>
                <option value="distributor">Distributor</option>
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </InputField>

          <InputField label="PAN / GST Number (GSTIN)" error={errors.panGstNumber}>
            <input
              type="text"
              value={form.panGstNumber || ""}
              onChange={(e) => handleChange("panGstNumber", e.target.value.toUpperCase())}
              disabled={!isEditable}
              placeholder="e.g. ABCDE1234F or 22AAAAA0000A1Z5"
              className={inputClass(errors.panGstNumber)}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Permanent PAN or GSTIN reference for tax compliance and seller verification.
            </p>
          </InputField>
        </div>
      </DashboardSection>

      {/* Registered Address */}
      <DashboardSection
        title="Registered Address"
        description="Your registered or principal business address."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <InputField label="Address Line 1" error={errors.registeredAddressLine1}>
              <input
                type="text"
                value={form.registeredAddressLine1 || ""}
                onChange={(e) => handleChange("registeredAddressLine1", e.target.value)}
                disabled={!isEditable}
                placeholder="Street address, building name"
                className={inputClass(errors.registeredAddressLine1)}
              />
            </InputField>
          </div>
          <div className="sm:col-span-2">
            <InputField label="Address Line 2">
              <input
                type="text"
                value={form.registeredAddressLine2 || ""}
                onChange={(e) => handleChange("registeredAddressLine2", e.target.value)}
                disabled={!isEditable}
                placeholder="Floor, suite, unit (optional)"
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

      {/* Business Details */}
      <DashboardSection
        title="Business Details"
        description="Public-facing business information visible on your seller profile."
      >
        <div className="space-y-5">
          <InputField label="Business Registration Info">
            <textarea
              value={form.businessRegistrationInfo || ""}
              onChange={(e) => handleChange("businessRegistrationInfo", e.target.value)}
              disabled={!isEditable}
              placeholder="Company registration number, incorporation details, etc."
              className={textareaClass(false)}
              rows={3}
            />
          </InputField>

          <InputField label="Public Business Description">
            <textarea
              value={form.publicBusinessDescription || ""}
              onChange={(e) => handleChange("publicBusinessDescription", e.target.value)}
              disabled={!isEditable}
              placeholder="Describe your business, specialization, and what you sell on the platform."
              className={textareaClass(false)}
              rows={4}
            />
          </InputField>

          {/* Product Categories */}
          <div>
            <span className="text-xs font-bold text-slate-700">Product Categories</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRODUCT_CATEGORY_OPTIONS.map((cat) => {
                const selected = (form.productCategories || []).includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    disabled={!isEditable}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${selected
                        ? "bg-[#2563eb] border-[#2563eb] text-white shadow-sm"
                        : "bg-white border-slate-200 text-slate-600 hover:border-[#2563eb] hover:text-[#2563eb]"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </DashboardSection>

      {/* Verification Documents */}
      <DashboardSection
        title="Verification Documents"
        description="Upload supporting documents (Government ID, Address Proof, GST / Tax Certificate, Business Registration). Accepted: JPEG, PNG, PDF (max 5 MB each)."
      >
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
            description="Upload business registration, tax certificate, or government ID documents to complete verification."
          />
        )}

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
            {saving ? "Saving…" : "Save Business Profile"}
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
