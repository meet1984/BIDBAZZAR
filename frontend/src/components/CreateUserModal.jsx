import React, { useState } from "react";
import { UserPlus, X, Eye, EyeOff } from "lucide-react";
import api from "../lib/api";
import { errorMessage } from "../lib/format";

export function CreateUserModal({ isOpen, onClose, onUserCreated }) {
  const [data, setData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    role: "buyer",
    sellerName: "",
    sellerType: "individual",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setData({
      fullName: "",
      email: "",
      phone: "",
      password: "",
      role: "buyer",
      sellerName: "",
      sellerType: "individual",
    });
    setShowPassword(false);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Client-side password validation
    if (data.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (!/[A-Za-z]/.test(data.password) || !/\d/.test(data.password)) {
      setError("Password must contain at least one letter and one number.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        fullName: data.fullName.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password,
        role: data.role,
        accountType: data.role,
      };

      if (data.phone && data.phone.trim()) {
        payload.phone = data.phone.trim();
      }

      if (data.role === "seller") {
        payload.sellerName = data.sellerName.trim() || data.fullName.trim();
        payload.sellerType = data.sellerType || "individual";
      }

      await api.post("/admin/users", payload);
      resetForm();
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
            type="button"
            onClick={handleClose}
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
              <label className="mb-1.5 block text-xs font-bold text-slate-700">Account Role</label>
              <select
                value={data.role}
                onChange={(e) => setData({ ...data, role: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-[#2563eb]"
                required
              >
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="admin">Administrator</option>
                <option value="admin_employee">Admin Employee</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">Full Name</label>
              <input
                type="text"
                value={data.fullName}
                onChange={(e) => setData({ ...data, fullName: e.target.value })}
                placeholder="e.g. Rahul Sharma"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-[#2563eb]"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">Email Address</label>
              <input
                type="email"
                value={data.email}
                onChange={(e) => setData({ ...data, email: e.target.value })}
                placeholder="name@example.com"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-[#2563eb]"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="tel"
                value={data.phone}
                onChange={(e) => setData({ ...data, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-[#2563eb]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={data.password}
                  onChange={(e) => setData({ ...data, password: e.target.value })}
                  placeholder="Min. 8 chars (letters & numbers)"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 pr-10 text-xs font-medium outline-none focus:border-[#2563eb]"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Must be at least 8 characters with at least 1 letter and 1 number.
              </p>
            </div>

            {isSellerMode && (
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4 space-y-3">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#2563eb]">
                  Seller Profile Details
                </p>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Seller / Store Name</label>
                  <input
                    type="text"
                    value={data.sellerName}
                    onChange={(e) => setData({ ...data, sellerName: e.target.value })}
                    placeholder="Store or Business Name"
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
              onClick={handleClose}
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
