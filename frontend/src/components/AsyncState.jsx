import React from "react";

export function LoadingState({ label = "Loading…" }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800" role="alert">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="mt-3 font-bold underline">
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, description }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <h3 className="text-base font-bold text-[#0f172a]">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
