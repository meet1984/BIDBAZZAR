import React, { useState } from "react";
import { UserPlus, X } from "lucide-react";
import api from "../lib/api";
import { errorMessage } from "../lib/format";

export function CreateUserModal({ isOpen, onClose, onUserCreated }) {
  const [data, setData] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "buyer",
    sellerName: "",
    sellerType: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = { ...data };
      if (payload.role !== "seller") {
        delete payload.sellerName;
        delete payload.sellerType;
      }
      await api.post("/admin/users", payload);
      onUserCreated();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Failed to create user."));
    } finally {
      setLoading(false);
    }
  };

  const isSellerMode = data.role === "seller";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-5 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-[#0f172a]">
            <UserPlus size={16} className="text-[#2563eb]" /> Create New User
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs font-medium text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">Role</label>
              <select
                value={data.role}
                onChange={(e) => setData({ ...data, role: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-[#2563eb]"
                required
              >
                <option value="buyer">Buyer Only</option>
                <option value="seller">Seller Only</option>
                <option value="admin">Admin</option>
                <option value="admin_employee">Admin employee</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">Full Name</label>
              <input
                type="password"
                value={data.fullName}
                onChange={(e) => setData({ ...data, fullName: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-[#2563eb]"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">Email</label>
              <input
                type="email"
                value={data.email}
                onChange={(e) => setData({ ...data, email: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-[#2563eb]"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">Password</label>
              <input
                type="text"
                value={data.password}
                onChange={(e) => setData({ ...data, password: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-[#2563eb]"
                minLength={8}
                required
              />
            </div>

            {isSellerMode && (
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4 space-y-3">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#2563eb]">
                  Seller Details
                </p>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Seller Name</label>
                  <input
                    type="text"
                    value={data.sellerName}
                    onChange={(e) => setData({ ...data, sellerName: e.target.value })}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-[#2563eb]"
                    required={isSellerMode}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Seller Type</label>
                  <select
                    value={data.sellerType}
                    onChange={(e) => setData({ ...data, sellerType: e.target.value })}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-[#2563eb]"
                    required={isSellerMode}
                  >
                    <option value="">Select type</option>
                    <option value="individual">Individual</option>
                    <option value="business">Business</option>
                    <option value="distributor">Distributor</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-[#2563eb] px-5 py-2 text-xs font-bold text-white transition hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
