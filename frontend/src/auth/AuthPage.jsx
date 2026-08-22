import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  CircleAlert,
  Clock3,
  Eye,
  EyeOff,
  Gavel,
  HelpCircle,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Brand, Link } from "../components";
import { errorMessage } from "../lib/format";
import {
  focusFirstError,
  initialLogin,
  initialRegistration,
  isSafeInternalPath,
  validateLogin,
  validateRegistration,
} from "./authValidation";
import { useAuth } from "./AuthContext";

const inputClass =
  "mt-2 min-h-12 w-full rounded-md border border-slate-300 bg-white px-3.5 text-[14px] text-[#0f172a] outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10 disabled:cursor-not-allowed disabled:bg-slate-100";

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p
      id={id}
      className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-5 text-red-600"
    >
      <CircleAlert className="mt-0.5 shrink-0" size={14} aria-hidden="true" />
      {message}
    </p>
  );
}

function ErrorSummary({ errors }) {
  const messages = Object.values(errors).filter((message) => Boolean(message));
  if (messages.length < 2) return null;
  return (
    <div
      className="mb-5 rounded-md border border-red-200 bg-red-50 p-4 text-red-800"
      role="alert"
      tabIndex={-1}
    >
      <p className="flex items-center gap-2 text-[13px] font-bold">
        <CircleAlert size={16} /> Check the highlighted fields
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] leading-5">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  visible,
  onChange,
  onToggle,
  autoComplete,
  error,
  hint,
  disabled,
}) {
  const describedBy =
    [hint ? `${id}-hint` : "", error ? `${id}-error` : ""]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="text-[13px] font-semibold text-[#0f172a]">
        {label}{" "}
        <span className="text-[#2563eb]" aria-hidden="true">
          *
        </span>
        <span className="sr-only"> required</span>
      </label>
      <div className="relative">
        <input
          id={id}
          className={`${inputClass} pr-12`}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute bottom-1 right-1 grid h-10 w-10 place-items-center rounded text-slate-500 hover:bg-slate-100 hover:text-[#2563eb] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-[#2563eb]/30"
          aria-label={
            visible
              ? `Hide ${label.toLowerCase()}`
              : `Show ${label.toLowerCase()}`
          }
          aria-pressed={visible}
          disabled={disabled}
        >
          {visible ? (
            <EyeOff size={18} aria-hidden="true" />
          ) : (
            <Eye size={18} aria-hidden="true" />
          )}
        </button>
      </div>
      {hint && !error ? (
        <p
          id={`${id}-hint`}
          className="mt-1.5 text-[11px] leading-5 text-slate-500"
        >
          {hint}
        </p>
      ) : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function RequestMessage({ state, message }) {
  if (state === "idle" || state === "submitting") return null;
  const success = state === "success";
  return (
    <div
      className={`mb-5 rounded-md border p-4 text-[12px] leading-5 ${success
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-red-200 bg-red-50 text-red-800"
        }`}
      role={success ? "status" : "alert"}
    >
      <p className="flex items-start gap-2">
        {success ? (
          <Check className="mt-0.5 shrink-0" size={16} />
        ) : (
          <CircleAlert className="mt-0.5 shrink-0" size={16} />
        )}
        {message}
      </p>
    </div>
  );
}

function AuthVisualPanel() {
  return (
    <aside className="relative hidden min-h-screen overflow-hidden bg-[#0f172a] px-[clamp(44px,5vw,78px)] py-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div
        className="absolute -right-28 -top-28 h-96 w-96 rounded-full border border-white/10"
        aria-hidden="true"
      />
      <div
        className="absolute -right-10 top-8 h-56 w-56 rounded-full border border-white/10"
        aria-hidden="true"
      />
      <Link
        href="/"
        aria-label="bidmylot home"
        className="relative z-10 w-fit"
      >
        <Brand className="h-14 bg-white p-2 rounded-xl shadow-md" />
      </Link>

      <div className="relative z-10 my-12 max-w-[590px]">
        <p className="mb-5 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#60a5fa]">
          <Gavel size={15} aria-hidden="true" /> A considered marketplace
        </p>
        <h2 className="max-w-[570px] text-[clamp(40px,4.2vw,66px)] font-semibold leading-[1.02] tracking-[-0.055em]">
          Discover, bid and sell through a clearer auction experience.
        </h2>
        <p className="mt-6 max-w-[560px] text-[14px] leading-7 text-slate-300">
          Explore approved auctions as a buyer or prepare and submit listings
          through a structured seller workflow.
        </p>

        <div className="mt-10 max-w-[560px] overflow-hidden rounded-md border border-white/15 bg-[#1e293b] shadow-2xl shadow-black/25">
          <div className="relative h-40 overflow-hidden bg-gradient-to-r from-blue-900 via-slate-900 to-[#1e3a8a] p-5">
            <div
              className="absolute -bottom-24 right-5 h-48 w-48 rounded-full border-[20px] border-white/10"
              aria-hidden="true"
            />
            <span className="relative inline-flex items-center gap-2 rounded-sm bg-white px-2.5 py-1.5 text-[8px] font-extrabold uppercase tracking-[0.12em] text-[#2563eb]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2563eb]" /> Live
              auction
            </span>
            <Gavel
              className="absolute bottom-7 right-10 rotate-[-18deg] text-white/80"
              size={72}
              strokeWidth={1.25}
              aria-hidden="true"
            />
          </div>
          <div className="bg-white p-5 text-[#0f172a]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Collector timepiece · Lot 041
                </span>
                <h3 className="mt-1 text-[17px] font-bold tracking-[-0.025em] text-[#0f172a]">
                  Heritage Automatic Watch
                </h3>
              </div>
              <span className="shrink-0 rounded-sm bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700">
                Reviewed
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 border-y border-slate-200 py-3">
              <span className="flex flex-col text-[9px] uppercase tracking-[0.08em] text-slate-500">
                Current price{" "}
                <b className="mt-1 text-[16px] normal-case tracking-normal text-[#0f172a]">
                  ₹48,500
                </b>
              </span>
              <span className="flex flex-col border-l border-slate-200 pl-5 text-[9px] uppercase tracking-[0.08em] text-slate-500">
                Closing time{" "}
                <b className="mt-1 flex items-center gap-1.5 text-[14px] normal-case tracking-normal text-[#0f172a]">
                  <Clock3 size={14} /> 02h 18m
                </b>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-2 text-[10px] text-slate-400">
        <BadgeCheck size={14} className="text-[#60a5fa]" /> Seller listings are
        published only after review.
      </div>
    </aside>
  );
}

function LoginForm() {
  const { login, verifyOtp, resendOtp } = useAuth();
  const [data, setData] = useState(initialLogin);
  const [errors, setErrors] = useState({});
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [requestState, setRequestState] = useState("idle");
  const [requestMessage, setRequestMessage] = useState("");

  // OTP State
  const [otpChallenge, setOtpChallenge] = useState(null);
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendState, setResendState] = useState("idle");

  const [loginRole, setLoginRole] = useState(() => {
    if (typeof window !== "undefined" && window.location.pathname.includes("seller")) {
      return "seller";
    }
    return "buyer";
  });

  const returnTo = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const candidate = params.get("returnTo");
    return isSafeInternalPath(candidate) ? candidate : null;
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const update = (field, value) => {
    setData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (requestState !== "idle") setRequestState("idle");
  };

  function handleSuccessfulSession(body) {
    setRequestState("success");
    setRequestMessage(
      body.message || "Your sign-in was confirmed. Taking you to your account…",
    );
    const userType = body.user?.accountType || body.accountType || body.role || "buyer";
    const roleRoute = `/${userType === "admin_employee" ? "admin" : userType}/dashboard`;
    const destination = returnTo || (isSafeInternalPath(body.redirectTo || null) ? body.redirectTo : roleRoute);
    window.setTimeout(() => window.location.assign(destination), 400);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (requestState === "submitting") return;
    const nextErrors = validateLogin(data);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      focusFirstError(nextErrors);
      return;
    }

    setRequestState("submitting");
    setRequestMessage("");
    try {
      const path = typeof window !== "undefined" ? window.location.pathname : "";
      const isAdmin = path.includes("admin");
      const loginEndpoint = isAdmin
        ? "/auth/admin/login"
        : loginRole === "seller"
          ? "/auth/seller/login"
          : "/auth/buyer/login";

      const response = await login(
        {
          email: data.email.trim().toLowerCase(),
          password: data.password,
          rememberMe: data.rememberMe,
          returnTo,
        },
        loginEndpoint,
      );

      if (response?.otpRequired) {
        setOtpChallenge({
          challengeId: response.challengeId,
          email: data.email.trim().toLowerCase(),
          expiresInSeconds: response.expiresInSeconds || 600,
        });
        setOtpCode("");
        setResendCooldown(45);
        setRequestState("idle");
        setRequestMessage("");
        return;
      }

      handleSuccessfulSession(response);
    } catch (error) {
      const status = error?.response?.status;
      if (status === 429) {
        setRequestState("auth-error");
        setRequestMessage(error?.response?.data?.message || "Too many attempts, retry again later.");
      } else {
        setRequestState(status === 401 || status === 403 ? "auth-error" : "server-error");
        setRequestMessage(
          status === 401 || status === 403
            ? "We could not sign you in with those details. Check your information and try again."
            : error?.response?.data?.message ||
            "We could not reach bidmylot. Check your connection and try again.",
        );
      }
    }
  }

  async function handleVerifyOtpSubmit(event) {
    event.preventDefault();
    if (requestState === "submitting" || !otpChallenge) return;
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setErrors({ otp: "Please enter a valid 6-digit code." });
      return;
    }

    setRequestState("submitting");
    setRequestMessage("");
    setErrors({});

    try {
      const body = await verifyOtp({
        challengeId: otpChallenge.challengeId,
        otp: otpCode.trim(),
      });
      handleSuccessfulSession(body);
    } catch (error) {
      const code = error?.response?.data?.code;
      setRequestState("auth-error");
      setRequestMessage(errorMessage(error, "Failed to verify 6-digit code."));
      if (code === "OTP_ATTEMPTS_EXCEEDED" || code === "CHALLENGE_NOT_FOUND") {
        setTimeout(() => {
          setOtpChallenge(null);
          setOtpCode("");
        }, 2500);
      }
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0 || !otpChallenge || resendState === "submitting") return;
    setResendState("submitting");
    try {
      const result = await resendOtp({ challengeId: otpChallenge.challengeId });
      setOtpChallenge((prev) => ({ ...prev, challengeId: result.challengeId }));
      setOtpCode("");
      setResendCooldown(45);
      setRequestState("idle");
      setRequestMessage("A new verification code has been sent to your email.");
    } catch (error) {
      setRequestState("auth-error");
      setRequestMessage(errorMessage(error, "Failed to resend verification code."));
    } finally {
      setResendState("idle");
    }
  }

  if (otpChallenge) {
    return (
      <form onSubmit={handleVerifyOtpSubmit} noValidate>
        <RequestMessage state={requestState} message={requestMessage} />

        <div className="mb-6 rounded-md border border-blue-200 bg-blue-50/70 p-4">
          <p className="flex items-center gap-2 text-[13px] font-bold text-[#0f172a]">
            <LockKeyhole size={16} className="text-[#2563eb]" /> 2-Step Verification Required
          </p>
          <p className="mt-1 text-[12px] leading-5 text-slate-600">
            We sent a 6-digit sign-in code to <b>{otpChallenge.email}</b>. Enter it below to complete sign in.
          </p>
        </div>

        <div className="space-y-5">
          <div>
            <label htmlFor="otpCode" className="text-[13px] font-semibold text-[#0f172a]">
              6-digit verification code{" "}
              <span className="text-[#2563eb]" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="otpCode"
              className={`${inputClass} text-center font-mono text-lg tracking-[0.35em]`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={otpCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                setOtpCode(val);
                if (errors.otp) setErrors({});
              }}
              autoFocus
              disabled={requestState === "submitting"}
            />
            <FieldError id="otpCode-error" message={errors.otp} />
          </div>

          <div className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-1.5 text-slate-500">
              <Clock3 size={14} /> Expires in 10 minutes
            </span>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendCooldown > 0 || resendState === "submitting"}
              className="font-bold text-[#2563eb] hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
            </button>
          </div>

          <button
            type="submit"
            disabled={requestState === "submitting" || otpCode.length !== 6}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#2563eb] px-5 text-[13px] font-bold text-white shadow-sm transition hover:bg-[#1d4ed8] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2563eb]/30 disabled:cursor-not-allowed disabled:opacity-65"
          >
            {requestState === "submitting" ? (
              <>
                <LoaderCircle className="animate-spin" size={17} /> Verifying code…
              </>
            ) : (
              <>
                Verify & Sign In <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setOtpChallenge(null);
              setOtpCode("");
              setRequestState("idle");
              setRequestMessage("");
            }}
            className="text-[12px] font-semibold text-slate-500 hover:text-[#2563eb]"
          >
            ← Back to email & password sign in
          </button>
        </div>
      </form>
    );
  }

  const isPathAdmin = typeof window !== "undefined" && window.location.pathname.includes("admin");

  return (
    <form onSubmit={handleSubmit} noValidate>
      <ErrorSummary errors={errors} />
      <RequestMessage state={requestState} message={requestMessage} />

      {!isPathAdmin && (
        <div className="mb-6 flex rounded-lg bg-slate-100 p-1 border border-slate-200/80 shadow-xs">
          <button
            type="button"
            onClick={() => setLoginRole("buyer")}
            className={`flex-1 rounded-md py-2.5 text-center text-xs font-bold transition-all ${loginRole === "buyer"
                ? "bg-[#2563eb] text-white shadow-xs"
                : "text-slate-600 hover:text-[#0f172a]"
              }`}
          >
            Buyer Sign In
          </button>
          <button
            type="button"
            onClick={() => setLoginRole("seller")}
            className={`flex-1 rounded-md py-2.5 text-center text-xs font-bold transition-all ${loginRole === "seller"
                ? "bg-[#0f172a] text-white shadow-xs"
                : "text-slate-600 hover:text-[#0f172a]"
              }`}
          >
            Seller Sign In
          </button>
        </div>
      )}

      <div className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="text-[13px] font-semibold text-[#0f172a]"
          >
            Email address{" "}
            <span className="text-[#2563eb]" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> required</span>
          </label>
          <input
            id="email"
            className={inputClass}
            type="email"
            value={data.email}
            onChange={(event) => update("email", event.target.value)}
            autoComplete="email"
            maxLength={254}
            required
            disabled={requestState === "submitting"}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          <FieldError id="email-error" message={errors.email} />
        </div>
        <PasswordField
          id="password"
          label="Password"
          value={data.password}
          visible={passwordVisible}
          onChange={(value) => update("password", value)}
          onToggle={() => setPasswordVisible((current) => !current)}
          autoComplete="current-password"
          error={errors.password}
          disabled={requestState === "submitting"}
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <label className="flex cursor-pointer items-start gap-2.5 text-[12px] leading-5 text-slate-600">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[#2563eb]"
              checked={data.rememberMe}
              onChange={(event) => update("rememberMe", event.target.checked)}
              disabled={requestState === "submitting"}
            />
            <span>
              <b className="font-semibold text-[#0f172a]">Keep me signed in</b>
              <br />
              <span className="text-[10px] text-slate-500">
                Use this only on a personal device.
              </span>
            </span>
          </label>
          <Link
            href="/forgot-password"
            className="text-[12px] font-bold text-[#2563eb] underline decoration-[#2563eb]/30 underline-offset-4 hover:decoration-[#2563eb]"
          >
            Forgot password?
          </Link>
        </div>
        <button
          type="submit"
          disabled={requestState === "submitting"}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#2563eb] px-5 text-[13px] font-bold text-white shadow-sm transition hover:bg-[#1d4ed8] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2563eb]/30 disabled:cursor-not-allowed disabled:opacity-65"
        >
          {requestState === "submitting" ? (
            <>
              <LoaderCircle className="animate-spin" size={17} /> Signing in…
            </>
          ) : (
            <>
              Sign In <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
      <p className="mt-7 text-center text-[13px] text-slate-600">
        {typeof window !== "undefined" && window.location.pathname.includes("admin") ? (
          <span className="text-slate-500">Public registration is disabled for administrator accounts.</span>
        ) : (
          <>
            New to bidmylot?{" "}
            <Link
              href={typeof window !== "undefined" && window.location.pathname.includes("seller") ? "/seller/register" : "/buyer/register"}
              className="font-bold text-[#2563eb] hover:underline"
            >
              Create an account
            </Link>
          </>
        )}
      </p>
      <p className="sr-only" aria-live="polite">
        {requestState === "submitting" ? "Signing in" : requestMessage}
      </p>
    </form>
  );
}

function RegistrationForm() {
  const { register, verifyOtp, resendOtp } = useAuth();
  const [data, setData] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedRole =
      params.get("role") ||
      (window.location.pathname.includes("seller") ? "seller" : "buyer");
    return {
      ...initialRegistration,
      role: requestedRole === "seller" ? "seller" : "buyer",
    };
  });
  const [errors, setErrors] = useState({});
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [requestState, setRequestState] = useState("idle");
  const [requestMessage, setRequestMessage] = useState("");

  // OTP State
  const [otpChallenge, setOtpChallenge] = useState(null);
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendState, setResendState] = useState("idle");

  const returnTo = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const candidate = params.get("returnTo");
    return isSafeInternalPath(candidate) ? candidate : null;
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const update = (field, value) => {
    setData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (requestState !== "idle") setRequestState("idle");
  };

  function handleSuccessfulSession(body) {
    setRequestState("success");
    setRequestMessage(
      body.message || "Your account was verified. Taking you to your dashboard…",
    );
    const roleRoute = body.role ? `/${body.role}/dashboard` : "/";
    const destination = returnTo || (isSafeInternalPath(body.redirectTo || null) ? body.redirectTo : roleRoute);
    window.setTimeout(() => window.location.assign(destination), 400);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (requestState === "submitting") return;
    const nextErrors = validateRegistration(data);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      focusFirstError(nextErrors);
      return;
    }

    setRequestState("submitting");
    setRequestMessage("");
    try {
      const isSeller = data.role === "seller";
      const regEndpoint = isSeller ? "/auth/seller/register" : "/auth/buyer/register";
      const body = await register(
        {
          accountType: isSeller ? "seller" : "buyer",
          fullName: data.fullName.trim(),
          email: data.email.trim().toLowerCase(),
          phone: data.phone.trim() || undefined,
          password: data.password,
          sellerName: isSeller ? data.sellerName.trim() : undefined,
          sellerType: isSeller ? data.sellerType : undefined,
          acceptedTerms: data.acceptedTerms,
          marketingConsent: data.marketingConsent,
        },
        regEndpoint,
      );

      if (body?.otpRequired) {
        setOtpChallenge({
          challengeId: body.challengeId,
          email: data.email.trim().toLowerCase(),
          expiresInSeconds: body.expiresInSeconds || 600,
        });
        setOtpCode("");
        setResendCooldown(45);
        setRequestState("idle");
        setRequestMessage("");
        return;
      }

      setRequestState("success");
      setRequestMessage(
        body.message ||
        "Your account was created successfully. You can now continue to sign in.",
      );
      setData((current) => ({ ...initialRegistration, role: current.role }));
    } catch (error) {
      const status = error?.response?.status;
      if (status === 429) {
        setRequestState("auth-error");
        setRequestMessage(error?.response?.data?.message || "Too many attempts, retry again later.");
      } else {
        setRequestState(status === 409 ? "auth-error" : "server-error");
        setRequestMessage(
          status === 409
            ? "An account may already exist with this email address. Try signing in."
            : error?.response?.data?.message ||
            "We could not reach bidmylot. Check your connection and try again.",
        );
      }
    }
  }

  async function handleVerifyOtpSubmit(event) {
    event.preventDefault();
    if (requestState === "submitting" || !otpChallenge) return;
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setErrors({ otp: "Please enter a valid 6-digit code." });
      return;
    }

    setRequestState("submitting");
    setRequestMessage("");
    setErrors({});

    try {
      const body = await verifyOtp({
        challengeId: otpChallenge.challengeId,
        otp: otpCode.trim(),
      });
      handleSuccessfulSession(body);
    } catch (error) {
      const code = error?.response?.data?.code;
      setRequestState("auth-error");
      setRequestMessage(errorMessage(error, "Failed to verify 6-digit code."));
      if (code === "OTP_ATTEMPTS_EXCEEDED" || code === "CHALLENGE_NOT_FOUND") {
        setTimeout(() => {
          setOtpChallenge(null);
          setOtpCode("");
        }, 2500);
      }
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0 || !otpChallenge || resendState === "submitting") return;
    setResendState("submitting");
    try {
      const result = await resendOtp({ challengeId: otpChallenge.challengeId });
      setOtpChallenge((prev) => ({ ...prev, challengeId: result.challengeId }));
      setOtpCode("");
      setResendCooldown(45);
      setRequestState("idle");
      setRequestMessage("A new verification code has been sent to your email.");
    } catch (error) {
      setRequestState("auth-error");
      setRequestMessage(errorMessage(error, "Failed to resend verification code."));
    } finally {
      setResendState("idle");
    }
  }

  if (otpChallenge) {
    return (
      <form onSubmit={handleVerifyOtpSubmit} noValidate>
        <RequestMessage state={requestState} message={requestMessage} />

        <div className="mb-6 rounded-md border border-blue-200 bg-blue-50/70 p-4">
          <p className="flex items-center gap-2 text-[13px] font-bold text-[#0f172a]">
            <LockKeyhole size={16} className="text-[#2563eb]" /> Account Verification Required
          </p>
          <p className="mt-1 text-[12px] leading-5 text-slate-600">
            We sent a 6-digit verification code to <b>{otpChallenge.email}</b>. Enter it below to activate your account.
          </p>
        </div>

        <div className="space-y-5">
          <div>
            <label htmlFor="otpCode" className="text-[13px] font-semibold text-[#0f172a]">
              6-digit verification code{" "}
              <span className="text-[#2563eb]" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="otpCode"
              className={`${inputClass} text-center font-mono text-lg tracking-[0.35em]`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={otpCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                setOtpCode(val);
                if (errors.otp) setErrors({});
              }}
              autoFocus
              disabled={requestState === "submitting"}
            />
            <FieldError id="otpCode-error" message={errors.otp} />
          </div>

          <div className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-1.5 text-slate-500">
              <Clock3 size={14} /> Expires in 10 minutes
            </span>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendCooldown > 0 || resendState === "submitting"}
              className="font-bold text-[#2563eb] hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
            </button>
          </div>

          <button
            type="submit"
            disabled={requestState === "submitting" || otpCode.length !== 6}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#2563eb] px-5 text-[13px] font-bold text-white shadow-sm transition hover:bg-[#1d4ed8] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2563eb]/30 disabled:cursor-not-allowed disabled:opacity-65"
          >
            {requestState === "submitting" ? (
              <>
                <LoaderCircle className="animate-spin" size={17} /> Verifying code…
              </>
            ) : (
              <>
                Verify & Activate Account <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setOtpChallenge(null);
              setOtpCode("");
              setRequestState("idle");
              setRequestMessage("");
            }}
            className="text-[12px] font-semibold text-slate-500 hover:text-[#2563eb]"
          >
            ← Back to registration
          </button>
        </div>
      </form>
    );
  }

  const isSeller = data.role === "seller";

  return (
    <form onSubmit={handleSubmit} noValidate>
      <ErrorSummary errors={errors} />
      <RequestMessage state={requestState} message={requestMessage} />

      <fieldset disabled={requestState === "submitting"}>
        <legend className="text-[13px] font-bold text-[#0f172a]">
          Account Type{" "}
          <span className="text-[#2563eb]" aria-hidden="true">
            *
          </span>
        </legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            {
              value: "buyer",
              title: "Buyer Account",
              copy: "Browse auctions & place bids.",
              icon: UserRound,
            },
            {
              value: "seller",
              title: "Seller Account",
              copy: "Submit & manage auctions.",
              icon: BriefcaseBusiness,
            },
          ].map((option) => {
            const selected = data.role === option.value;
            const Icon = option.icon;
            return (
              <label
                key={option.value}
                className={`relative cursor-pointer rounded-md border p-3.5 transition ${selected ? "border-[#2563eb] bg-blue-50/50 ring-1 ring-[#2563eb]" : "border-slate-300 bg-white hover:border-slate-400"}`}
              >
                <input
                  id={option.value === "buyer" ? "role" : undefined}
                  className="sr-only"
                  type="radio"
                  name="role"
                  value={option.value}
                  checked={selected}
                  onChange={() => update("role", option.value)}
                />
                <span className="flex items-start gap-2.5">
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${selected ? "bg-[#2563eb] text-white" : "bg-slate-100 text-slate-600"}`}
                  >
                    <Icon size={15} />
                  </span>
                  <span>
                    <b className="flex items-center gap-1 text-[12px] text-[#0f172a]">
                      {option.title}
                      {selected ? (
                        <Check size={13} className="text-[#2563eb]" />
                      ) : null}
                    </b>
                    <span className="mt-0.5 block text-[10px] leading-3.5 text-slate-500">
                      {option.copy}
                    </span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {isSeller ? (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50/70 p-3 text-[11px] leading-5 text-blue-900">
          <ShieldCheck className="mt-0.5 shrink-0" size={16} /> Creating a
          seller account requires seller registration details. Listings are published after review.
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label
            htmlFor="fullName"
            className="text-[13px] font-semibold text-[#0f172a]"
          >
            Full name{" "}
            <span className="text-[#2563eb]" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> required</span>
          </label>
          <input
            id="fullName"
            className={inputClass}
            type="text"
            value={data.fullName}
            onChange={(event) => update("fullName", event.target.value)}
            autoComplete="name"
            maxLength={100}
            required
            disabled={requestState === "submitting"}
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? "fullName-error" : undefined}
          />
          <FieldError id="fullName-error" message={errors.fullName} />
        </div>
        <div>
          <label
            htmlFor="email"
            className="text-[13px] font-semibold text-[#0f172a]"
          >
            Email address{" "}
            <span className="text-[#2563eb]" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> required</span>
          </label>
          <input
            id="email"
            className={inputClass}
            type="email"
            value={data.email}
            onChange={(event) => update("email", event.target.value)}
            autoComplete="email"
            maxLength={254}
            required
            disabled={requestState === "submitting"}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          <FieldError id="email-error" message={errors.email} />
        </div>
        <div>
          <label
            htmlFor="phone"
            className="text-[13px] font-semibold text-[#0f172a]"
          >
            Phone number{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="phone"
            className={inputClass}
            type="tel"
            value={data.phone}
            onChange={(event) => update("phone", event.target.value)}
            autoComplete="tel"
            maxLength={30}
            disabled={requestState === "submitting"}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "phone-error" : undefined}
          />
          <FieldError id="phone-error" message={errors.phone} />
        </div>
        <PasswordField
          id="password"
          label="Password"
          value={data.password}
          visible={passwordVisible}
          onChange={(value) => update("password", value)}
          onToggle={() => setPasswordVisible((current) => !current)}
          autoComplete="new-password"
          error={errors.password}
          hint="Use at least 8 characters with a mix of letters and numbers."
          disabled={requestState === "submitting"}
        />
        <PasswordField
          id="confirmPassword"
          label="Confirm password"
          value={data.confirmPassword}
          visible={confirmVisible}
          onChange={(value) => update("confirmPassword", value)}
          onToggle={() => setConfirmVisible((current) => !current)}
          autoComplete="new-password"
          error={errors.confirmPassword}
          disabled={requestState === "submitting"}
        />
      </div>

      {isSeller ? (
        <div className="mt-7 border-t border-slate-200 pt-6">
          <p className="mb-4 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#2563eb]">
            Seller details
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="sellerName"
                className="text-[13px] font-semibold text-[#0f172a]"
              >
                Seller or business name{" "}
                <span className="text-[#2563eb]" aria-hidden="true">
                  *
                </span>
                <span className="sr-only"> required</span>
              </label>
              <input
                id="sellerName"
                className={inputClass}
                type="text"
                value={data.sellerName}
                onChange={(event) => update("sellerName", event.target.value)}
                maxLength={120}
                required
                disabled={requestState === "submitting"}
                aria-invalid={Boolean(errors.sellerName)}
                aria-describedby={
                  errors.sellerName ? "sellerName-error" : undefined
                }
              />
              <FieldError id="sellerName-error" message={errors.sellerName} />
            </div>
            <div>
              <label
                htmlFor="sellerType"
                className="text-[13px] font-semibold text-[#0f172a]"
              >
                Seller type{" "}
                <span className="text-[#2563eb]" aria-hidden="true">
                  *
                </span>
                <span className="sr-only"> required</span>
              </label>
              <select
                id="sellerType"
                className={inputClass}
                value={data.sellerType}
                onChange={(event) => update("sellerType", event.target.value)}
                required
                disabled={requestState === "submitting"}
                aria-invalid={Boolean(errors.sellerType)}
                aria-describedby={
                  errors.sellerType ? "sellerType-error" : undefined
                }
              >
                <option value="">Choose a seller type</option>
                <option value="individual">Individual</option>
                <option value="business">Business</option>
                <option value="distributor">Distributor</option>
              </select>
              <FieldError id="sellerType-error" message={errors.sellerType} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-7 space-y-3 border-t border-slate-200 pt-6">
        <div>
          <label className="flex cursor-pointer items-start gap-2.5 text-[11px] leading-5 text-slate-600">
            <input
              id="acceptedTerms"
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#2563eb]"
              checked={data.acceptedTerms}
              onChange={(event) =>
                update("acceptedTerms", event.target.checked)
              }
              required
              disabled={requestState === "submitting"}
              aria-invalid={Boolean(errors.acceptedTerms)}
              aria-describedby={
                errors.acceptedTerms ? "acceptedTerms-error" : undefined
              }
            />
            <span>
              I agree to the bidmylot{" "}
              <Link
                href="/terms"
                className="font-bold text-[#2563eb] underline decoration-[#2563eb]/30 underline-offset-2"
              >
                Terms of Use
              </Link>{" "}
              and acknowledge the{" "}
              <Link
                href="/privacy"
                className="font-bold text-[#2563eb] underline decoration-[#2563eb]/30 underline-offset-2"
              >
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          <FieldError id="acceptedTerms-error" message={errors.acceptedTerms} />
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 text-[11px] leading-5 text-slate-600">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#2563eb]"
            checked={data.marketingConsent}
            onChange={(event) =>
              update("marketingConsent", event.target.checked)
            }
            disabled={requestState === "submitting"}
          />
          <span>
            Send me occasional bidmylot updates.{" "}
            <span className="text-slate-500">Optional</span>
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={requestState === "submitting"}
        className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#2563eb] px-5 text-[13px] font-bold text-white shadow-sm transition hover:bg-[#1d4ed8] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#2563eb]/30 disabled:cursor-not-allowed disabled:opacity-65"
      >
        {requestState === "submitting" ? (
          <>
            <LoaderCircle className="animate-spin" size={17} /> Creating
            account…
          </>
        ) : (
          <>
            Create {data.role === "seller" ? "Seller" : "Buyer"} Account{" "}
            <ArrowRight size={16} />
          </>
        )}
      </button>
      <p className="mt-7 text-center text-[13px] text-slate-600">
        Already have an account?{" "}
        <Link
          href={data.role === "seller" ? "/seller/login" : "/buyer/login"}
          className="font-bold text-[#2563eb] hover:underline"
        >
          Sign in
        </Link>
      </p>
      <p className="sr-only" aria-live="polite">
        {requestState === "submitting" ? "Creating account" : requestMessage}
      </p>
    </form>
  );
}

export function AuthPageShell({ mode }) {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const isSeller = mode === "seller-login" || mode === "seller-register" || path.includes("seller");
  const isAdmin = mode === "admin-login" || path.includes("admin");
  const isLogin = mode ? mode.endsWith("-login") || mode === "login" : !path.includes("register");

  const badgeText = isAdmin
    ? "Admin Portal"
    : isSeller
      ? "Seller Portal"
      : "Buyer Portal";

  const pageTitle = isLogin
    ? isAdmin
      ? "Admin Sign In"
      : isSeller
        ? "Seller Sign In"
        : "Buyer Sign In"
    : isSeller
      ? "Create a Seller Account"
      : "Create a Buyer Account";

  const pageDescription = isLogin
    ? isAdmin
      ? "Sign in with your administrator credentials to manage platform records."
      : isSeller
        ? "Sign in to access your seller dashboard, create listings, and track auctions."
        : "Sign in to access your buyer dashboard, place bids, and track watchlist items."
    : isSeller
      ? "Register a seller account to list property items for public auction."
      : "Register a buyer account to start bidding on active property auctions.";

  return (
    <main className="min-h-screen bg-[#f8fafc] text-[#0f172a] lg:grid lg:grid-cols-[minmax(440px,0.92fr)_minmax(560px,1.08fr)]">
      <AuthVisualPanel />
      <section className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-[clamp(52px,7vw,112px)] lg:py-10">
        <div className="mx-auto flex w-full max-w-[620px] items-center justify-between gap-6">
          <div className="lg:hidden">
            <Link href="/" aria-label="bidmylot home">
              <Brand className="h-12" />
            </Link>
          </div>
          <Link
            href="/"
            className="ml-auto inline-flex min-h-10 items-center gap-2 text-[12px] font-semibold text-slate-600 transition hover:text-[#2563eb]"
          >
            <ArrowLeft size={15} /> Back to home
          </Link>
        </div>

        <div
          className={`mx-auto my-auto w-full max-w-[620px] py-12 ${isLogin ? "lg:max-w-[500px]" : "lg:py-8"}`}
        >
          <div className="mb-6">
            <span className="mb-4 inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#2563eb]">
              {isLogin ? <LockKeyhole size={15} /> : <UserRound size={15} />}{" "}
              {badgeText} — {isLogin ? "Sign In" : "Registration"}
            </span>
            <h1 className="text-[clamp(35px,4vw,52px)] font-semibold leading-[1.05] tracking-[-0.055em] text-[#0f172a]">
              {pageTitle}
            </h1>
            <p className="mt-4 max-w-[590px] text-[13px] leading-6 text-slate-600">
              {pageDescription}
            </p>
          </div>

          {isLogin ? <LoginForm mode={mode} /> : <RegistrationForm mode={mode} />}
        </div>

        <div className="mx-auto flex w-full max-w-[620px] flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 text-[10px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={13} /> Your details are sent only to the
            configured server endpoint.
          </span>
          <Link
            href="/contact"
            className="inline-flex items-center gap-1.5 font-bold text-slate-600 hover:text-[#2563eb]"
          >
            <HelpCircle size={13} /> Need help?
          </Link>
        </div>
      </section>
    </main>
  );
}

export function AuthenticationPage({ initialMode }) {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const mode =
    initialMode ||
    (path.includes("/seller/register")
      ? "seller-register"
      : path.includes("/seller/login")
        ? "seller-login"
        : path.includes("/admin/login")
          ? "admin-login"
          : path.includes("/register") || path.includes("/signup") || path.includes("/buyer/register")
            ? "buyer-register"
            : "buyer-login");
  return <AuthPageShell mode={mode} />;
}

export default AuthenticationPage;
