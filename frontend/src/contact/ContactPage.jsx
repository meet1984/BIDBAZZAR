import React, { useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  FileText,
  Gavel,
  Info,
  LifeBuoy,
  LoaderCircle,
  LockKeyhole,
  Paperclip,
  RotateCcw,
  Send,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { Navbar, Footer, Link } from "../components";
import api from "../lib/api";
import { useAuth } from "../auth/AuthContext";

const reasonOptions = [
  {
    value: "auction-dispute",
    label: "Auction dispute",
    guidance:
      "Include the auction reference, lot number, and describe the dispute in detail.",
    referenceRecommended: true,
  },
  {
    value: "seller-complaint",
    label: "Seller complaint",
    guidance:
      "Provide details of the seller and auction listing involved in your complaint.",
    referenceRecommended: true,
  },
  {
    value: "buyer-complaint",
    label: "Buyer complaint",
    guidance:
      "Explain the buyer breach regarding your confirmed deal.",
    referenceRecommended: true,
  },
  {
    value: "direct-deal",
    label: "Confirmed deal issue",
    guidance:
      "Describe the issue with a confirmed direct deal without sharing sensitive credentials.",
    referenceRecommended: true,
  },
  {
    value: "buyer-account",
    label: "Buyer account",
    guidance:
      "Tell us whether you are having trouble registering, signing in or accessing your buyer dashboard.",
    referenceRecommended: false,
  },
  {
    value: "seller-account",
    label: "Seller account",
    guidance:
      "Describe the issue affecting your seller registration, login or dashboard.",
    referenceRecommended: false,
  },
  {
    value: "auction-bidding",
    label: "Auction or bidding",
    guidance:
      "Include the auction reference and describe what happened. Do not submit passwords or OTP codes.",
    referenceRecommended: true,
  },
  {
    value: "listing-submission",
    label: "Listing submission",
    guidance:
      "Include the listing reference if available and explain which part of the submission needs assistance.",
    referenceRecommended: true,
  },
  {
    value: "listing-review",
    label: "Listing review",
    guidance:
      "Include the listing reference and current review status shown in your seller dashboard.",
    referenceRecommended: true,
  },
  {
    value: "technical",
    label: "Technical issue",
    guidance:
      "Describe what you were trying to do, what happened and which device or browser you were using.",
    referenceRecommended: false,
  },
  {
    value: "general",
    label: "General enquiry",
    guidance:
      "Share enough information for the team to understand and route your enquiry.",
    referenceRecommended: false,
  },
];

const roleOptions = [
  { value: "buyer", label: "Buyer" },
  { value: "seller", label: "Seller" },
  { value: "visitor", label: "Visitor" },
  { value: "other", label: "Other" },
];

const initialFormData = {
  fullName: "",
  email: "",
  phone: "",
  role: "",
  reason: "general",
  subject: "",
  reference: "",
  message: "",
  consent: false,
};

const MAX_SUBJECT_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 1500;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const ACCEPTED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
];

const fieldLabels = {
  fullName: "Full name",
  email: "Email address",
  phone: "Phone number",
  role: "I am contacting as",
  reason: "Contact reason",
  subject: "Subject",
  reference: "Auction or listing reference",
  message: "Message",
  consent: "Confirmation",
  attachment: "Attachment",
};

const supportOptions = [
  {
    title: "Account assistance",
    description:
      "Help with buyer or seller registration, login and dashboard access.",
    cta: "Account Help",
    href: "/support/accounts",
    icon: UserRound,
  },
  {
    title: "Auction assistance",
    description:
      "Questions about listings, auction status, bidding or review decisions.",
    cta: "Auction Help",
    href: "/support/auctions",
    icon: Gavel,
  },
  {
    title: "General assistance",
    description: "Questions that do not fit an existing support category.",
    cta: "Contact Support",
    icon: LifeBuoy,
  },
];

const fieldClass =
  "mt-2 min-h-12 w-full rounded-[5px] border border-[#cbd5e1] bg-white px-3.5 text-[14px] text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] hover:border-[#94a3b8] focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10 disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

function validateForm(data, attachment) {
  const errors = {};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!data.fullName.trim()) errors.fullName = "Enter your full name.";
  if (!data.email.trim()) {
    errors.email = "Enter your email address.";
  } else if (!emailPattern.test(data.email.trim())) {
    errors.email = "Enter a valid email address, such as name@example.com.";
  }
  if (!data.role)
    errors.role =
      "Choose whether you are contacting as a buyer, seller, visitor or other.";
  if (!data.subject.trim()) {
    errors.subject = "Add a short subject for your enquiry.";
  } else if (data.subject.trim().length < 4) {
    errors.subject = "Make the subject at least 4 characters long.";
  }
  if (!data.message.trim()) {
    errors.message = "Describe the question or issue you need help with.";
  } else if (data.message.trim().length < 20) {
    errors.message =
      "Add a little more detail—your message must be at least 20 characters.";
  }
  if (!data.consent)
    errors.consent =
      "Confirm that your enquiry is accurate and contains no sensitive information.";

  if (attachment && !ACCEPTED_ATTACHMENT_TYPES.includes(attachment.type)) {
    errors.attachment = "Choose a JPG, PNG or PDF file.";
  } else if (attachment && attachment.size > MAX_ATTACHMENT_BYTES) {
    errors.attachment = "Choose a file smaller than 5 MB.";
  }

  return errors;
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p
      id={id}
      className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-5 text-[#e11d48]"
    >
      <CircleAlert className="mt-0.5 shrink-0" size={14} aria-hidden="true" />
      {message}
    </p>
  );
}

function RequiredMark() {
  return (
    <span className="ml-1 text-[#2563eb]" aria-hidden="true">
      *
    </span>
  );
}

function ContactReasonSelector({ value, onChange, disabled }) {
  const selected =
    reasonOptions.find((option) => option.value === value) ?? reasonOptions[6];

  return (
    <fieldset disabled={disabled}>
      <legend className="text-[15px] font-semibold tracking-[-0.01em] text-[#0f172a]">
        What do you need help with?
        <RequiredMark />
      </legend>
      <div
        className="mt-3 flex flex-wrap gap-2"
        role="radiogroup"
        aria-describedby="reason-guidance"
      >
        {reasonOptions.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`inline-flex min-h-11 items-center gap-2 rounded-[4px] border px-3.5 text-[12px] font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2563eb]/20 disabled:cursor-not-allowed disabled:opacity-60 ${isSelected
                  ? "border-[#0f172a] bg-[#0f172a] text-white shadow-sm"
                  : "border-[#e2e8f0] bg-[#f8fafc] text-[#475569] hover:border-[#2563eb] hover:bg-white hover:text-[#2563eb]"
                }`}
              onClick={() => onChange(option.value)}
            >
              {isSelected && <Check size={14} aria-hidden="true" />}
              {option.label}
            </button>
          );
        })}
      </div>
      <div
        id="reason-guidance"
        className="mt-3 flex items-start gap-2.5 rounded-[4px] border border-[#bfdbfe] bg-[#eff6ff] px-3.5 py-3 text-[12px] leading-5 text-[#334155]"
        aria-live="polite"
      >
        <Info
          className="mt-0.5 shrink-0 text-[#2563eb]"
          size={15}
          aria-hidden="true"
        />
        <span>{selected.guidance}</span>
      </div>
    </fieldset>
  );
}

function SupportOption({
  title,
  description,
  cta,
  href,
  icon: Icon,
  onContact,
}) {
  const content = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#cbd5e1] bg-white text-[#2563eb]">
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-[13px] font-semibold text-[#0f172a]">
          {title}
        </strong>
        <span className="mt-1 block text-[11px] leading-[1.65] text-[#64748b]">
          {description}
        </span>
        <span className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#2563eb]">
          {cta}
          <ArrowRight size={13} aria-hidden="true" />
        </span>
      </span>
    </>
  );

  const className =
    "group flex w-full items-start gap-3.5 border-t border-[#e2e8f0] py-4 text-left transition hover:translate-x-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2563eb]/15 motion-reduce:transform-none";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onContact}>
      {content}
    </button>
  );
}

export default function ContactPage() {
  const { user } = useAuth();
  const [formData, setFormData] = useState(initialFormData);

  React.useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        fullName: prev.fullName || user.fullName || "",
        email: prev.email || user.email || "",
        role: prev.role || (user.role === "admin" ? "other" : user.role) || "",
      }));
    }
  }, [user]);

  const [errors, setErrors] = useState({});
  const [attachment, setAttachment] = useState(null);
  const [submissionState, setSubmissionState] = useState("idle");
  const [enquiryReference, setEnquiryReference] = useState(null);
  const formRef = useRef(null);
  const fileInputRef = useRef(null);

  const selectedReason =
    reasonOptions.find((option) => option.value === formData.reason) ??
    reasonOptions[6];
  const isSubmitting = submissionState === "submitting";
  const errorEntries = Object.entries(errors);

  const setField = (key, value) => {
    setFormData((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    if (submissionState !== "idle") setSubmissionState("idle");
  };

  const focusForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(
      () => formRef.current?.querySelector("button[role='radio']")?.focus(),
      400,
    );
  };

  const handleAttachment = (event) => {
    const file = event.target.files?.[0] ?? null;
    setAttachment(file);
    setErrors((current) => {
      const next = { ...current };
      delete next.attachment;
      if (file && !ACCEPTED_ATTACHMENT_TYPES.includes(file.type)) {
        next.attachment = "Choose a JPG, PNG or PDF file.";
      } else if (file && file.size > MAX_ATTACHMENT_BYTES) {
        next.attachment = "Choose a file smaller than 5 MB.";
      }
      return next;
    });
  };

  const removeAttachment = () => {
    setAttachment(null);
    setErrors((current) => {
      const next = { ...current };
      delete next.attachment;
      return next;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const focusFirstInvalidField = (nextErrors) => {
    const firstField = Object.keys(nextErrors)[0];
    if (!firstField) return;
    window.requestAnimationFrame(() => {
      const target =
        firstField === "attachment"
          ? fileInputRef.current
          : formRef.current?.querySelector(`[name="${firstField}"]`);
      target?.focus();
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validateForm(formData, attachment);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setSubmissionState("idle");
      focusFirstInvalidField(nextErrors);
      return;
    }

    setSubmissionState("submitting");
    setEnquiryReference(null);

    try {
      const payload = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        payload.append(key, String(value));
      });
      if (attachment) payload.append("attachment", attachment);
      const { data } = await api.post("/support/enquiries", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setEnquiryReference(data.reference);
      setSubmissionState("success");
    } catch (error) {
      setSubmissionState(error?.response ? "server-error" : "network-error");
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setAttachment(null);
    setErrors({});
    setSubmissionState("idle");
    setEnquiryReference(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    window.requestAnimationFrame(() =>
      formRef.current?.querySelector("button[role='radio']")?.focus(),
    );
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8fafc] text-[#0f172a] selection:bg-[#2563eb] selection:text-white">
      <Navbar />
      <main className="bg-[#f8fafc] text-[#0f172a]">
        <section
          aria-labelledby="contact-heading"
          className="px-4 py-14 sm:px-6 sm:py-20 lg:px-10 lg:py-24 xl:px-20"
        >
          <div className="mx-auto grid max-w-[1360px] items-start gap-12 lg:grid-cols-[minmax(0,0.76fr)_minmax(560px,1.24fr)] lg:gap-14 xl:gap-24">
            <div className="min-w-0 lg:sticky lg:top-8">
              <div className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#2563eb]">
                <LifeBuoy size={16} aria-hidden="true" />
                Contact bidmylot
              </div>
              <h1
                id="contact-heading"
                className="mt-5 max-w-xl text-[42px] font-semibold leading-[1.02] tracking-[-0.055em] text-[#0f172a] sm:text-[54px] lg:text-[62px]"
              >
                How can we help?
              </h1>
              <p className="mt-6 max-w-xl text-[16px] leading-7 text-[#475569] sm:text-[17px]">
                Tell us what you need help with, and your enquiry can be
                directed to the appropriate bidmylot team.
              </p>

              <div className="mt-7 flex max-w-xl items-start gap-3 border-l-2 border-[#2563eb] bg-[#eff6ff] px-4 py-4 text-[12px] leading-5 text-[#334155]">
                <ShieldCheck
                  className="mt-0.5 shrink-0 text-[#2563eb]"
                  size={18}
                  aria-hidden="true"
                />
                <p>
                  For faster assistance, include the relevant auction, listing
                  or account details—but never include passwords, OTP codes,
                  financial account details, or other sensitive information.
                </p>
              </div>

              <div className="mt-10 max-w-xl">
                <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[#0f172a]">
                  Choose the right place to start
                </h2>
                <p className="mt-2 text-[12px] leading-5 text-[#64748b]">
                  Use a focused support route or send the team a detailed
                  enquiry.
                </p>
                <div className="mt-4 border-b border-[#e2e8f0]">
                  {supportOptions.map((option) => (
                    <SupportOption
                      key={option.title}
                      {...option}
                      onContact={focusForm}
                    />
                  ))}
                </div>
              </div>

              <aside
                className="mt-8 max-w-xl rounded-[5px] border border-[#e2e8f0] bg-white p-5 sm:p-6"
                aria-labelledby="contact-reminder-heading"
              >
                <div className="flex items-center gap-2 text-[#2563eb]">
                  <Info size={18} aria-hidden="true" />
                  <h2
                    id="contact-reminder-heading"
                    className="text-[14px] font-semibold text-[#0f172a]"
                  >
                    Before sending your enquiry
                  </h2>
                </div>
                <ul className="mt-4 space-y-2.5 text-[12px] leading-5 text-[#475569]">
                  {[
                    "Check that your email address is correct.",
                    "Include an auction or listing reference when relevant.",
                    "Explain what you expected and what happened.",
                    "Never share your password, OTP, card details or banking credentials.",
                    "Upload only files that are relevant to the enquiry.",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check
                        className="mt-1 shrink-0 text-[#10b981]"
                        size={13}
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>

            <div className="min-w-0">
              <form
                ref={formRef}
                id="contact-form"
                noValidate
                onSubmit={handleSubmit}
                className="scroll-mt-8 rounded-[7px] border border-[#e2e8f0] bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8 lg:p-10"
                aria-labelledby="form-heading"
              >
                <div className="flex flex-col gap-3 border-b border-[#e2e8f0] pb-6 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#2563eb]">
                      Send an enquiry
                    </p>
                    <h2
                      id="form-heading"
                      className="mt-2 text-[25px] font-semibold tracking-[-0.035em] text-[#0f172a] sm:text-[29px]"
                    >
                      Tell us what happened.
                    </h2>
                  </div>
                  <p className="text-[11px] text-[#64748b]">
                    <span className="font-bold text-[#2563eb]">*</span> Required
                    fields
                  </p>
                </div>

                {errorEntries.length > 1 && (
                  <div
                    className="mt-6 rounded-[4px] border border-[#fecdd3] bg-[#fff1f2] p-4"
                    role="alert"
                    aria-labelledby="error-summary-title"
                  >
                    <div className="flex items-start gap-3">
                      <CircleAlert
                        className="mt-0.5 shrink-0 text-[#e11d48]"
                        size={19}
                        aria-hidden="true"
                      />
                      <div>
                        <h3
                          id="error-summary-title"
                          className="text-[13px] font-semibold text-[#9f1239]"
                        >
                          Please correct {errorEntries.length} fields
                        </h3>
                        <ul className="mt-2 space-y-1 text-[12px] leading-5 text-[#be123c]">
                          {errorEntries.map(([field, message]) => (
                            <li key={field}>
                              <button
                                type="button"
                                className="text-left underline decoration-[#f43f5e] underline-offset-2 hover:text-[#881337]"
                                onClick={() =>
                                  formRef.current
                                    ?.querySelector(
                                      field === "attachment"
                                        ? "#attachment"
                                        : `[name="${field}"]`,
                                    )
                                    ?.focus()
                                }
                              >
                                {fieldLabels[field]}: {message}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-7">
                  <ContactReasonSelector
                    value={formData.reason}
                    disabled={isSubmitting}
                    onChange={(reason) => setField("reason", reason)}
                  />
                </div>

                <div className="mt-8 grid gap-x-5 gap-y-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="fullName"
                      className="text-[12px] font-semibold text-[#1e293b]"
                    >
                      Full name
                      <RequiredMark />
                    </label>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      autoComplete="name"
                      required
                      disabled={isSubmitting}
                      value={formData.fullName}
                      onChange={(event) =>
                        setField("fullName", event.target.value)
                      }
                      className={fieldClass}
                      aria-invalid={Boolean(errors.fullName)}
                      aria-describedby={
                        errors.fullName ? "fullName-error" : undefined
                      }
                    />
                    <FieldError id="fullName-error" message={errors.fullName} />
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="text-[12px] font-semibold text-[#1e293b]"
                    >
                      Email address
                      <RequiredMark />
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      disabled={isSubmitting}
                      value={formData.email}
                      onChange={(event) =>
                        setField("email", event.target.value)
                      }
                      className={fieldClass}
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={
                        errors.email ? "email-error" : undefined
                      }
                    />
                    <FieldError id="email-error" message={errors.email} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="phone"
                        className="text-[12px] font-semibold text-[#1e293b]"
                      >
                        Phone number
                      </label>
                      <span className="text-[10px] text-[#64748b]">
                        Optional
                      </span>
                    </div>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      disabled={isSubmitting}
                      value={formData.phone}
                      onChange={(event) =>
                        setField("phone", event.target.value)
                      }
                      className={fieldClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="role"
                      className="text-[12px] font-semibold text-[#1e293b]"
                    >
                      I am contacting as
                      <RequiredMark />
                    </label>
                    <select
                      id="role"
                      name="role"
                      required
                      disabled={isSubmitting}
                      value={formData.role}
                      onChange={(event) => setField("role", event.target.value)}
                      className={`${fieldClass} appearance-none bg-[linear-gradient(45deg,transparent_50%,#64748b_50%),linear-gradient(135deg,#64748b_50%,transparent_50%)] bg-[position:calc(100%-17px)_21px,calc(100%-12px)_21px] bg-[size:5px_5px,5px_5px] bg-no-repeat pr-10`}
                      aria-invalid={Boolean(errors.role)}
                      aria-describedby={errors.role ? "role-error" : undefined}
                    >
                      <option value="">Select one</option>
                      {roleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <FieldError id="role-error" message={errors.role} />
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="subject"
                        className="text-[12px] font-semibold text-[#1e293b]"
                      >
                        Subject
                        <RequiredMark />
                      </label>
                      <span className="text-[10px] text-[#64748b]">
                        {formData.subject.length}/{MAX_SUBJECT_LENGTH}
                      </span>
                    </div>
                    <input
                      id="subject"
                      name="subject"
                      type="text"
                      required
                      maxLength={MAX_SUBJECT_LENGTH}
                      disabled={isSubmitting}
                      value={formData.subject}
                      onChange={(event) =>
                        setField("subject", event.target.value)
                      }
                      className={fieldClass}
                      aria-invalid={Boolean(errors.subject)}
                      aria-describedby={
                        errors.subject ? "subject-error" : "subject-help"
                      }
                    />
                    <p id="subject-help" className="sr-only">
                      Maximum {MAX_SUBJECT_LENGTH} characters.
                    </p>
                    <FieldError id="subject-error" message={errors.subject} />
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor="reference"
                        className="text-[12px] font-semibold text-[#1e293b]"
                      >
                        Auction or listing reference
                      </label>
                      <span
                        className={`text-[10px] font-medium ${selectedReason.referenceRecommended ? "text-[#2563eb]" : "text-[#64748b]"}`}
                      >
                        {selectedReason.referenceRecommended
                          ? "Recommended for this enquiry"
                          : "Optional"}
                      </span>
                    </div>
                    <input
                      id="reference"
                      name="reference"
                      type="text"
                      disabled={isSubmitting}
                      value={formData.reference}
                      onChange={(event) =>
                        setField("reference", event.target.value)
                      }
                      placeholder="For example, the reference shown on the auction or seller dashboard"
                      className={fieldClass}
                      aria-describedby="reference-help"
                    />
                    <p
                      id="reference-help"
                      className="mt-1.5 text-[10px] leading-4 text-[#64748b]"
                    >
                      This helps route your enquiry; it will be checked by the
                      support system after submission.
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="message"
                        className="text-[12px] font-semibold text-[#1e293b]"
                      >
                        Message
                        <RequiredMark />
                      </label>
                      <span
                        className={`text-[10px] tabular-nums ${formData.message.length > MAX_MESSAGE_LENGTH - 100 ? "font-semibold text-[#2563eb]" : "text-[#64748b]"}`}
                        aria-live="off"
                      >
                        {formData.message.length}/{MAX_MESSAGE_LENGTH}
                      </span>
                    </div>
                    <textarea
                      id="message"
                      name="message"
                      required
                      rows={7}
                      maxLength={MAX_MESSAGE_LENGTH}
                      disabled={isSubmitting}
                      value={formData.message}
                      onChange={(event) =>
                        setField("message", event.target.value)
                      }
                      placeholder="Describe your question or issue and include any relevant details."
                      className={`${fieldClass} min-h-40 resize-y py-3 leading-6`}
                      aria-invalid={Boolean(errors.message)}
                      aria-describedby={
                        errors.message
                          ? "message-error message-help"
                          : "message-help"
                      }
                    />
                    <p
                      id="message-help"
                      className="mt-1.5 text-[10px] leading-4 text-[#64748b]"
                    >
                      Minimum 20 characters. Do not include passwords, OTPs, or
                      financial account details.
                    </p>
                    <FieldError id="message-error" message={errors.message} />
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor="attachment"
                        className="text-[12px] font-semibold text-[#1e293b]"
                      >
                        Attachment
                      </label>
                      <span className="text-[10px] text-[#64748b]">
                        Optional · JPG, PNG or PDF · Max 5 MB
                      </span>
                    </div>
                    <div
                      className={`mt-2 rounded-[5px] border border-dashed px-4 py-4 ${errors.attachment ? "border-[#f43f5e] bg-[#fff1f2]" : "border-[#cbd5e1] bg-[#f8fafc]"}`}
                    >
                      {attachment ? (
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[4px] bg-white text-[#2563eb] shadow-sm">
                            <FileText size={18} aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] font-semibold text-[#1e293b]">
                              {attachment.name}
                            </span>
                            <span className="mt-0.5 block text-[10px] text-[#64748b]">
                              {(attachment.size / 1024 / 1024).toFixed(2)} MB ·
                              Included with this enquiry when submitted
                            </span>
                          </span>
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={removeAttachment}
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#64748b] transition hover:bg-white hover:text-[#2563eb] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2563eb]/15"
                            aria-label={`Remove ${attachment.name}`}
                          >
                            <X size={17} aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <label
                          htmlFor="attachment"
                          className="flex min-h-12 cursor-pointer items-center justify-center gap-2.5 rounded-[4px] text-center text-[12px] font-semibold text-[#334155] transition hover:bg-white hover:text-[#2563eb]"
                        >
                          <Paperclip size={17} aria-hidden="true" />
                          Optional: attach a screenshot or supporting image
                        </label>
                      )}
                      <input
                        ref={fileInputRef}
                        id="attachment"
                        name="attachment"
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                        disabled={isSubmitting}
                        onChange={handleAttachment}
                        className="sr-only"
                        aria-invalid={Boolean(errors.attachment)}
                        aria-describedby={
                          errors.attachment
                            ? "attachment-error"
                            : "attachment-help"
                        }
                      />
                      <p id="attachment-help" className="sr-only">
                        Optional attachment. Accepted formats are JPG, PNG or
                        PDF, up to 5 MB.
                      </p>
                    </div>
                    <FieldError
                      id="attachment-error"
                      message={errors.attachment}
                    />
                  </div>
                </div>

                <div className="mt-7 border-t border-[#e2e8f0] pt-6">
                  <div className="flex items-start gap-3">
                    <input
                      id="consent"
                      name="consent"
                      type="checkbox"
                      required
                      disabled={isSubmitting}
                      checked={formData.consent}
                      onChange={(event) =>
                        setField("consent", event.target.checked)
                      }
                      className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#2563eb] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2563eb]/20"
                      aria-invalid={Boolean(errors.consent)}
                      aria-describedby={
                        errors.consent ? "consent-error" : undefined
                      }
                    />
                    <label
                      htmlFor="consent"
                      className="cursor-pointer text-[11px] leading-5 text-[#475569]"
                    >
                      I confirm that the information provided is accurate and
                      does not contain passwords, OTP codes, financial details, or other
                      sensitive account information.
                      <RequiredMark />
                    </label>
                  </div>
                  <FieldError id="consent-error" message={errors.consent} />
                </div>

                <div className="mt-7" aria-live="polite" aria-atomic="true">
                  {submissionState === "success" && (
                    <div
                      className="mb-5 rounded-[5px] border border-[#a7f3d0] bg-[#ecfdf5] p-4 text-[#065f46]"
                      role="status"
                    >
                      <div className="flex items-start gap-3">
                        <CheckCircle2
                          className="mt-0.5 shrink-0 text-[#10b981]"
                          size={20}
                          aria-hidden="true"
                        />
                        <div>
                          <h3 className="text-[13px] font-semibold">
                            Your enquiry has been received.
                          </h3>
                          <p className="mt-1 text-[11px] leading-5">
                            Thank you for contacting bidmylot. Keep your
                            enquiry reference available if you need to follow
                            up.
                          </p>
                          {enquiryReference && (
                            <p className="mt-2 text-[11px] font-bold">
                              Enquiry reference: {enquiryReference}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={resetForm}
                            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold underline underline-offset-2"
                          >
                            <RotateCcw size={13} /> Send another enquiry
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {(submissionState === "server-error" ||
                    submissionState === "network-error") && (
                      <div
                        className="mb-5 rounded-[5px] border border-[#fecdd3] bg-[#fff1f2] p-4 text-[#9f1239]"
                        role="alert"
                      >
                        <div className="flex items-start gap-3">
                          <CircleAlert
                            className="mt-0.5 shrink-0 text-[#e11d48]"
                            size={20}
                            aria-hidden="true"
                          />
                          <div>
                            <h3 className="text-[13px] font-semibold">
                              We could not send your enquiry.
                            </h3>
                            <p className="mt-1 text-[11px] leading-5">
                              {submissionState === "network-error"
                                ? "Check your connection, then try again. Your form details are still here."
                                : "Please review the information and try again. Your form details are still here."}
                            </p>
                            <button
                              type="submit"
                              className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold underline underline-offset-2"
                            >
                              <RotateCcw size={13} aria-hidden="true" /> Try again
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                </div>

                {submissionState !== "success" && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="flex items-center gap-2 text-[10px] leading-4 text-[#64748b]">
                      <LockKeyhole
                        className="shrink-0 text-[#10b981]"
                        size={14}
                        aria-hidden="true"
                      />
                      Your request will be checked securely by the support
                      service.
                    </p>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-[5px] border border-[#2563eb] bg-[#2563eb] px-6 text-[12px] font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#1d4ed8] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2563eb]/25 disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:translate-y-0 motion-reduce:transform-none sm:w-auto"
                    >
                      {isSubmitting ? (
                        <LoaderCircle
                          className="animate-spin motion-reduce:animate-none"
                          size={17}
                          aria-hidden="true"
                        />
                      ) : (
                        <Send size={16} aria-hidden="true" />
                      )}
                      {isSubmitting ? "Sending…" : "Send Enquiry"}
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
