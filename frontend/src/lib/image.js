export const DEFAULT_FALLBACK_IMAGE = "/hero-auction-marketplace.png";

/**
 * Returns the backend base origin without trailing slashes.
 * e.g. "https://api.bidmylot.com" if VITE_BACKEND_URL is set,
 * or derived from VITE_API_URL ("https://api.bidmylot.com/api" -> "https://api.bidmylot.com").
 */
export function getBackendBaseUrl() {
  const customBackendUrl = import.meta.env.VITE_BACKEND_URL;
  if (customBackendUrl && typeof customBackendUrl === "string") {
    return customBackendUrl.trim().replace(/\/+$/, "");
  }

  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl && typeof apiUrl === "string") {
    const trimmed = apiUrl.trim().replace(/\/+$/, "");
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed.replace(/\/api\/?$/i, "");
    }
  }

  return "";
}

/**
 * Resolves an image URL for display across environments.
 * - Handles external absolute URLs (http, https)
 * - Handles data URIs (data:image/...) and object URLs (blob:)
 * - Prepends backend origin to relative backend storage paths (/uploads/...)
 * - Returns a fallback image when the URL is empty, invalid, or null
 */
export function resolveImageUrl(url, fallback = DEFAULT_FALLBACK_IMAGE) {
  if (!url || typeof url !== "string") {
    return fallback;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return fallback;
  }

  // Already an absolute URL, data URI, or blob URL
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }

  // If path is a relative backend upload (e.g. /uploads/... or uploads/...)
  if (trimmed.startsWith("/uploads") || trimmed.startsWith("uploads/")) {
    const backendOrigin = getBackendBaseUrl();
    const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return backendOrigin ? `${backendOrigin}${normalizedPath}` : normalizedPath;
  }

  // Other relative root paths (e.g. public frontend assets like /hero-auction-marketplace.png)
  return trimmed;
}

export default resolveImageUrl;
