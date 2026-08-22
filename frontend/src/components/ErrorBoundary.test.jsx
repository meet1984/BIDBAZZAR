import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

function BombComponent({ shouldThrow }) {
  if (shouldThrow) {
    throw new Error("Simulated Crash in Child Component");
  }
  return <div>Normal Component Content</div>;
}

describe("Frontend ErrorBoundary Component", () => {
  it("renders children normally when no error occurs", () => {
    render(
      <ErrorBoundary>
        <BombComponent shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Normal Component Content")).toBeInTheDocument();
  });

  it("catches thrown render errors and displays fallback UI", () => {
    // Suppress console.error output during deliberate error test
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BombComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Simulated Crash in Child Component")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /return to homepage/i })).toBeInTheDocument();

    spy.mockRestore();
  });
});
