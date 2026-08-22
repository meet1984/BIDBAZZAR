import React from "react";
import { Brand } from "./index";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Unhandled React UI Error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="grid min-h-screen place-items-center bg-[#f8fafc] px-5 text-center">
          <section className="max-w-md rounded-xl bg-white p-8 shadow-sm border border-slate-200">
            <Brand />
            <h1 className="mt-6 text-3xl font-bold text-[#0f172a]">Something went wrong</h1>
            <p className="mt-3 text-sm text-slate-600">
              An unexpected error occurred while rendering this page.
            </p>
            {this.state.error?.message && (
              <pre className="mt-4 max-h-32 overflow-auto rounded bg-red-50 p-2 text-left text-xs text-red-600 font-mono">
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={this.handleReload}
                className="rounded bg-[#2563eb] px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition"
              >
                Return to Homepage
              </button>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
