import React, { useState, useEffect } from "react";

const FALLBACK_IMAGE = "/hero-auction-marketplace.png";

/**
 * Shared responsive image with a safe local fallback.
 *
 * `fill`, `sizes` and `priority` intentionally mirror the props used by the
 * existing page components, while the rendered element remains a normal HTML
 * image suitable for this Vite project.
 */
export function Image({
  src,
  alt,
  fill,
  priority,
  sizes,
  className,
  style,
  ...props
}) {
  const [imgSrc, setImgSrc] = useState(src);

  useEffect(() => {
    setImgSrc(src);
  }, [src]);

  return (
    <img
      src={imgSrc}
      alt={alt || ""}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      onError={() => {
        if (imgSrc !== FALLBACK_IMAGE) {
          setImgSrc(FALLBACK_IMAGE);
        }
      }}
      className={`${fill ? "absolute inset-0 h-full w-full object-cover" : ""} ${className || ""}`}
      style={style}
      {...props}
    />
  );
}

export default Image;
