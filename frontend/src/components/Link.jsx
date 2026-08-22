import React from "react";

/**
 * Small anchor wrapper used throughout the Vite app.
 *
 * App.jsx listens for same-origin anchor clicks and performs the client-side
 * navigation. The `to` prop is kept because existing page code may use the
 * React Router naming convention.
 */
export function Link({ href, to, children, className, onClick, ...props }) {
  const target = href ?? to ?? "#";
  return (
    <a href={target} className={className} onClick={onClick} {...props}>
      {children}
    </a>
  );
}

export default Link;
