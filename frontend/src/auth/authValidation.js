/**
 * Initial form values and validation rules for the existing authentication
 * page. They live outside the JSX so a beginner can update form rules without
 * searching through the page layout.
 */
export const initialLogin = {
  email: "",
  password: "",
  rememberMe: false,
};

export const initialRegistration = {
  role: "buyer",
  fullName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  sellerName: "",
  sellerType: "",
  acceptedTerms: false,
  marketingConsent: false,
};

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const isSafeInternalPath = (value) =>
  Boolean(
    value &&
      value.startsWith("/") &&
      !value.startsWith("//") &&
      !value.includes("\\"),
  );

export function validateLogin(data) {
  const errors = {};

  if (!data.email.trim()) {
    errors.email = "Enter your email address.";
  } else if (!isEmail(data.email.trim())) {
    errors.email = "Enter a valid email address, such as name@example.com.";
  }

  if (!data.password) errors.password = "Enter your password.";
  return errors;
}

export function validateRegistration(data) {
  const errors = {};

  if (!data.fullName.trim()) {
    errors.fullName = "Enter your full name.";
  } else if (data.fullName.trim().length > 100) {
    errors.fullName = "Keep your full name within 100 characters.";
  }

  if (!data.email.trim()) {
    errors.email = "Enter your email address.";
  } else if (!isEmail(data.email.trim())) {
    errors.email = "Enter a valid email address, such as name@example.com.";
  }

  if (data.phone.trim().length > 30) {
    errors.phone = "Keep the phone number within 30 characters.";
  }

  if (!data.password) {
    errors.password = "Create a password.";
  } else if (
    data.password.length < 8 ||
    !/[A-Za-z]/.test(data.password) ||
    !/\d/.test(data.password)
  ) {
    errors.password =
      "Use at least 8 characters with a mix of letters and numbers.";
  }

  if (!data.confirmPassword) {
    errors.confirmPassword = "Confirm your password.";
  } else if (data.password !== data.confirmPassword) {
    errors.confirmPassword = "The passwords do not match.";
  }

  if (data.role === "seller" || data.role === "both") {
    if (!data.sellerName.trim()) {
      errors.sellerName = "Enter your seller or business name.";
    } else if (data.sellerName.trim().length > 120) {
      errors.sellerName = "Keep the seller name within 120 characters.";
    }

    if (!data.sellerType) {
      errors.sellerType =
        "Choose individual, business, or distributor.";
    }
  }

  if (!data.acceptedTerms) {
    errors.acceptedTerms =
      "Agree to the Terms of Use and acknowledge the Privacy Policy to continue.";
  }

  return errors;
}

export function focusFirstError(errors) {
  const firstField = Object.keys(errors)[0];
  window.setTimeout(() => document.getElementById(firstField)?.focus(), 0);
}
