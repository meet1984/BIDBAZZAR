export function formatINR(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function formatCurrency(amount, currency = "INR") {
  if (amount == null || Number.isNaN(Number(amount))) return "—";
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

export function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function errorMessage(error, fallback = "The request could not be completed.") {
  const data = error?.response?.data;
  const code = data?.code;

  if (error?.response?.status === 429 || code === "RATE_LIMITED") {
    return data?.message || "Too many attempts, retry again later.";
  }

  if (code === "OTP_INVALID") {
    return data?.message || "Invalid verification code. Please check the code sent to your email and try again.";
  }
  if (code === "OTP_EXPIRED") {
    return "The verification code has expired. Please click 'Resend code' to receive a new code.";
  }
  if (code === "OTP_ATTEMPTS_EXCEEDED") {
    return "Maximum verification attempts exceeded. Please restart sign in with your password.";
  }
  if (code === "CHALLENGE_NOT_FOUND") {
    return "Your verification session has expired or is invalid. Please sign in again.";
  }

  if (data?.details?.fieldErrors) {
    const fieldEntries = Object.entries(data.details.fieldErrors);
    if (fieldEntries.length > 0) {
      const messages = fieldEntries.map(([field, errs]) => `${field}: ${errs.join(", ")}`);
      return `${data.message || fallback} (${messages.join("; ")})`;
    }
  }
  return data?.message || error?.message || fallback;
}
