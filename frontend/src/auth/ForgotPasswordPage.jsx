import React, { useState } from "react";
import { Brand, Link } from "../components";
import api from "../lib/api";
import { errorMessage } from "../lib/format";

const inputClass = "w-full rounded border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export default function ForgotPasswordPage() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    if (token && password !== confirmation) {
      setMessage("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (token) {
        await api.post("/auth/password/reset", { token, password });
        setMessage("Password updated. You can now sign in.");
      } else {
        await api.post("/auth/password/forgot", { email });
        setMessage("If that account exists, a reset link has been sent.");
      }
    } catch (requestError) {
      setMessage(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <Brand />
        <h1 className="mt-7 text-2xl font-bold">{token ? "Set a new password" : "Reset your password"}</h1>
        <p className="mt-2 text-sm text-slate-500">{token ? "Use at least 8 characters with a letter and number." : "We will send a short-lived, single-use reset link."}</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {token ? <>
            <input type="password" minLength={8} maxLength={72} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" className={inputClass}/>
            <input type="password" minLength={8} maxLength={72} required autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Confirm new password" className={inputClass}/>
          </> : <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" className={inputClass}/>} 
          <button disabled={busy} className="w-full rounded bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{busy ? "Submitting…" : token ? "Update password" : "Send reset link"}</button>
        </form>
        {message && <p className="mt-4 rounded bg-slate-100 p-3 text-xs leading-5">{message}</p>}
        <Link href="/login" className="mt-6 inline-block text-xs font-bold text-blue-700">Back to sign in</Link>
      </section>
    </main>
  );
}
