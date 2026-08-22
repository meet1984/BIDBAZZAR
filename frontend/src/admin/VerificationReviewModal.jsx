import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Shield,
  ShieldAlert,
  X,
  XCircle,
} from "lucide-react";
import api from "../lib/api";
import { errorMessage, formatDateTime } from "../lib/format";
import { LoadingState } from "../components";

export function VerificationReviewModal({ target, isOpen, onClose, onActionSuccess }) {
  const [profileData, setProfileData] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState(null); // 'approve' | 'request_changes' | 'reject' | 'suspend'
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [actionError, setActionError] = useState("");

  const loadDetails = useCallback(async () => {
    if (!target) return;
    setLoading(true);
    setError("");
    setProfileData(null);
    setDocuments([]);
    try {
      const accId = target.accountId || target.id || target.account_id;
      const accType = target.accountType || target.type || "buyer";

      const profileEndpoint = `/admin/verification/${accType}/${accId}/profile`;
      const docsEndpoint = `/admin/verification/${accType}/${accId}/documents`;

      const [profileRes, docsRes] = await Promise.allSettled([
        api.get(profileEndpoint),
        api.get(docsEndpoint),
      ]);

      if (profileRes.status === "fulfilled") {
        const body = profileRes.value.data.data || profileRes.value.data;
        setProfileData(body.profile || body);
      } else {
        // Fallback to public profile if admin profile endpoint fails
        try {
          const pubEndpoint =
            accType === "buyer"
              ? `/buyer/profile/public/${accId}`
              : `/seller/profile/public/${accId}`;
          const pubRes = await api.get(pubEndpoint);
          setProfileData(pubRes.data.data || pubRes.data);
        } catch {
          // ignore
        }
      }

      let fetchedDocs = [];
      if (docsRes.status === "fulfilled") {
        fetchedDocs = docsRes.value.data.data || docsRes.value.data || [];
      }

      // Fallback query if primary endpoint returned no docs
      if ((!Array.isArray(fetchedDocs) || fetchedDocs.length === 0) && accId) {
        try {
          const fallbackRes = await api.get("/verification/documents", {
            params: { accountId: accId },
          });
          fetchedDocs = fallbackRes.data.data || fallbackRes.data || [];
        } catch {
          // ignore fallback failure
        }
      }

      setDocuments(Array.isArray(fetchedDocs) ? fetchedDocs : []);
    } catch (err) {
      setError(errorMessage(err, "Failed to load account verification details."));
    } finally {
      setLoading(false);
    }
  }, [target]);

  useEffect(() => {
    if (isOpen && target) {
      void loadDetails();
      setAction(null);
      setReason("");
      setActionError("");
    }
  }, [isOpen, target, loadDetails]);

  if (!isOpen || !target) return null;

  const handleExecuteAction = async () => {
    if ((action === "reject" || action === "request_changes") && !reason.trim()) {
      setActionError("A detailed reason is required for rejection or change requests.");
      return;
    }

    setProcessing(true);
    setActionError("");

    try {
      const type = target.accountType || target.type || "buyer";
      const id = target.accountId || target.id || target.account_id;

      if (action === "approve") {
        await api.post(`/admin/verification/${type}/${id}/approve`);
      } else if (action === "reject") {
        await api.post(`/admin/verification/${type}/${id}/reject`, { reason: reason.trim() });
      } else if (action === "request_changes") {
        await api.post(`/admin/verification/${type}/${id}/request-changes`, { reason: reason.trim() });
      } else if (action === "suspend") {
        await api.post(`/admin/verification/${type}/${id}/suspend`, { reason: reason.trim() || "Suspended by admin" });
      }

      onActionSuccess();
      onClose();
    } catch (err) {
      setActionError(errorMessage(err, "Action failed."));
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadDoc = async (docId) => {
    try {
      const response = await api.get(`/verification/documents/${docId}/download`, { responseType: "blob" });
      const objectUrl = URL.createObjectURL(response.data);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (requestError) {
      setActionError(errorMessage(requestError, "Document download failed."));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[#2563eb]">
              <Shield size={20} />
            </span>
            <div>
              <h3 className="text-lg font-black text-[#0f172a]">
                Review {target.accountType === "buyer" ? "Buyer" : "Seller"} Verification
              </h3>
              <p className="text-xs text-slate-500">
                Account ID #{target.accountId} · {target.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="mt-5 space-y-6 max-h-[65vh] overflow-y-auto pr-1">
          {loading ? (
            <LoadingState label="Loading profile verification details..." />
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{error}</div>
          ) : (
            <>
              {/* Account & Profile Summary */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                    Submitted Profile Details
                  </h4>
                  <div className="grid gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <span className="text-slate-500 font-bold">Legal / Full Name:</span>{" "}
                      <span className="font-extrabold text-[#0f172a]">
                        {profileData?.legalFullName || profileData?.legalName || profileData?.businessName || target.fullName}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold">Account Type:</span>{" "}
                      <span className="capitalize font-bold text-[#0f172a]">{target.accountType}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold">Current Verification Status:</span>{" "}
                      <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase text-[#2563eb]">
                        {target.verificationStatus}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold">Submitted Date:</span>{" "}
                      <span className="font-semibold text-slate-700">
                        {target.verificationSubmittedAt ? formatDateTime(target.verificationSubmittedAt) : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Identity & Legal Info */}
                <div className="border-t border-slate-200/80 pt-3">
                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Identity & Legal Information
                  </h5>
                  <div className="grid gap-3 text-xs sm:grid-cols-2">
                    {profileData?.dateOfBirth && (
                      <div>
                        <span className="text-slate-500 font-bold">Date of Birth:</span>{" "}
                        <span className="font-semibold text-slate-800">{profileData.dateOfBirth}</span>
                      </div>
                    )}
                    {profileData?.buyerType && (
                      <div>
                        <span className="text-slate-500 font-bold">Buyer Type:</span>{" "}
                        <span className="capitalize font-semibold text-slate-800">{profileData.buyerType}</span>
                      </div>
                    )}
                    {profileData?.sellerType && (
                      <div>
                        <span className="text-slate-500 font-bold">Seller Type:</span>{" "}
                        <span className="capitalize font-semibold text-slate-800">{profileData.sellerType}</span>
                      </div>
                    )}
                    {profileData?.governmentIdType && (
                      <div>
                        <span className="text-slate-500 font-bold">Government ID Type:</span>{" "}
                        <span className="capitalize font-semibold text-slate-800">
                          {profileData.governmentIdType.replace(/_/g, " ")}
                        </span>
                      </div>
                    )}
                    {profileData?.maskedGovernmentIdRef && (
                      <div>
                        <span className="text-slate-500 font-bold">Government ID Reference:</span>{" "}
                        <span className="font-mono font-extrabold text-[#2563eb]">
                          {profileData.maskedGovernmentIdRef}
                        </span>
                      </div>
                    )}
                    {profileData?.panGstRef && (
                      <div>
                        <span className="text-slate-500 font-bold">PAN / GST Ref:</span>{" "}
                        <span className="font-mono font-extrabold text-[#2563eb]">{profileData.panGstRef}</span>
                      </div>
                    )}
                    {profileData?.businessName && (
                      <div>
                        <span className="text-slate-500 font-bold">Business Name:</span>{" "}
                        <span className="font-semibold text-slate-800">{profileData.businessName}</span>
                      </div>
                    )}
                    {profileData?.gstNumber && (
                      <div>
                        <span className="text-slate-500 font-bold">GST Number:</span>{" "}
                        <span className="font-mono font-extrabold text-slate-800">{profileData.gstNumber}</span>
                      </div>
                    )}
                    {profileData?.businessRegistrationInfo && (
                      <div>
                        <span className="text-slate-500 font-bold">Registration Info:</span>{" "}
                        <span className="font-semibold text-slate-800">{profileData.businessRegistrationInfo}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact & Address Info */}
                <div className="border-t border-slate-200/80 pt-3">
                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Contact & Registered Address
                  </h5>
                  <div className="grid gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <span className="text-slate-500 font-bold">Email:</span>{" "}
                      <span className="font-semibold text-slate-800">{target.email || profileData?.verifiedEmail || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold">Phone:</span>{" "}
                      <span className="font-semibold text-slate-800">{profileData?.verifiedPhone || "—"}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-500 font-bold">Address:</span>{" "}
                      <span className="font-semibold text-slate-800">
                        {[
                          profileData?.addressLine1 || profileData?.registeredAddressLine1,
                          profileData?.addressLine2 || profileData?.registeredAddressLine2,
                          profileData?.city,
                          profileData?.state,
                          profileData?.pinCode,
                          profileData?.country,
                        ]
                          .filter(Boolean)
                          .join(", ") || "Not specified"}
                      </span>
                    </div>
                  </div>
                </div>

                {profileData?.publicBusinessDescription && (
                  <div className="border-t border-slate-200/80 pt-3">
                    <span className="text-slate-500 font-bold block mb-1">Public Business Description:</span>
                    <p className="text-xs text-slate-700 leading-5">{profileData.publicBusinessDescription}</p>
                  </div>
                )}
              </div>

              {/* Submitted Documents */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                  Submitted Verification Documents
                </h4>
                {documents.length > 0 ? (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-[#2563eb]">
                            <FileText size={16} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-[#0f172a] truncate">{doc.originalName}</p>
                            <p className="text-[11px] text-slate-500">
                              {doc.documentType?.replace(/_/g, " ")} · {(doc.fileSize / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownloadDoc(doc.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#2563eb] hover:bg-blue-50 transition-colors"
                        >
                          <Download size={13} /> View File
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No verification documents attached.</p>
                )}
              </div>

              {/* Admin Action Selection */}
              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                  Select Administrator Decision
                </h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => { setAction("approve"); setActionError(""); }}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-bold transition-all ${action === "approve"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200"
                        : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300"
                      }`}
                  >
                    <CheckCircle2 size={18} className="text-emerald-600" />
                    Approve
                  </button>

                  <button
                    type="button"
                    onClick={() => { setAction("request_changes"); setActionError(""); }}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-bold transition-all ${action === "request_changes"
                        ? "border-purple-500 bg-purple-50 text-purple-800 ring-2 ring-purple-200"
                        : "border-slate-200 bg-white text-slate-700 hover:border-purple-300"
                      }`}
                  >
                    <AlertCircle size={18} className="text-purple-600" />
                    Request Changes
                  </button>

                  <button
                    type="button"
                    onClick={() => { setAction("reject"); setActionError(""); }}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-bold transition-all ${action === "reject"
                        ? "border-red-500 bg-red-50 text-red-800 ring-2 ring-red-200"
                        : "border-slate-200 bg-white text-slate-700 hover:border-red-300"
                      }`}
                  >
                    <XCircle size={18} className="text-red-600" />
                    Reject
                  </button>

                  <button
                    type="button"
                    onClick={() => { setAction("suspend"); setActionError(""); }}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-bold transition-all ${action === "suspend"
                        ? "border-red-700 bg-red-100 text-red-900 ring-2 ring-red-300"
                        : "border-slate-200 bg-white text-slate-700 hover:border-red-400"
                      }`}
                  >
                    <ShieldAlert size={18} className="text-red-700" />
                    Suspend
                  </button>
                </div>
              </div>

              {/* Reason Input */}
              {(action === "reject" || action === "request_changes" || action === "suspend") && (
                <div className="mt-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {action === "request_changes"
                      ? "Instructions for Requested Changes *"
                      : action === "reject"
                        ? "Rejection Reason *"
                        : "Suspension Reason"}
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={
                      action === "request_changes"
                        ? "Specify which documents or profile fields need updating..."
                        : "Provide clear reason for user notification..."
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-[#0f172a] focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                    rows={3}
                  />
                </div>
              )}

              {actionError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700 flex items-center gap-2">
                  <AlertCircle size={14} /> {actionError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          {action && (
            <button
              type="button"
              onClick={handleExecuteAction}
              disabled={processing}
              className={`inline-flex items-center gap-1.5 rounded-xl px-6 py-2.5 text-xs font-bold text-white transition-colors shadow-sm disabled:opacity-60 ${action === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : action === "request_changes"
                    ? "bg-purple-600 hover:bg-purple-700"
                    : action === "suspend"
                      ? "bg-red-800 hover:bg-red-900"
                      : "bg-red-600 hover:bg-red-700"
                }`}
            >
              {processing ? "Executing..." : `Confirm ${action.replace("_", " ")}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
