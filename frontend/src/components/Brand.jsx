import React from "react";

/**
 * Shared Brand logo component rendering the bidmylot image logo.
 */
export function Brand({ className = "h-8" }) {
  return (
    <img
      src="/logo.jpeg"
      alt="bidmylot"
      className={`object-contain inline-block ${className}`}
    />
  );
}

export default Brand;
