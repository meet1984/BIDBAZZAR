import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Users } from "lucide-react";
import { DashboardLayout, DashboardSection } from "../dashboard/DashboardLayout";
import { ErrorState, LoadingState } from "../components/AsyncState";
import api from "../lib/api";
import { errorMessage } from "../lib/format";

const permissions = [
  ["verification_review", "Verification review"],
  ["listing_review", "Listing review"],
  ["support_management", "Support management"],
  ["order_oversight", "Order oversight"],
  ["dispute_management", "Dispute management"],
  ["review_moderation", "Review moderation"],
  ["category_management", "Category management"],
];

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/employees");
      setEmployees(data.data || []);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (employee, permission) => {
    const key = `${employee.accountId}:${permission}`;
    setBusy(key);
    setError("");
    try {
      if (employee.permissions.includes(permission)) {
        await api.delete(`/admin/employees/${employee.accountId}/permissions/${permission}`);
      } else {
        await api.post(`/admin/employees/${employee.accountId}/permissions`, { permission });
      }
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusy("");
    }
  };

  return (
    <DashboardLayout role="admin" title="Employee permissions" description="Grant only the operational capabilities each employee needs.">
      {error && <ErrorState message={error} onRetry={load}/>} 
      <div className="mb-5 flex justify-end"><button onClick={load} className="flex items-center gap-2 rounded border bg-white px-4 py-2 text-xs font-bold"><RefreshCw size={14}/>Refresh</button></div>
      {loading ? <LoadingState label="Loading admin employees…"/> : (
        <DashboardSection title={`Admin employees (${employees.length})`} description="Create an admin_employee from Account Management, then assign permissions here.">
          {employees.length === 0 && <div className="flex items-center gap-3 rounded bg-slate-50 p-4 text-sm text-slate-500"><Users size={18}/>No admin employees exist.</div>}
          <div className="space-y-4">
            {employees.map((employee) => (
              <article key={employee.accountId} className="rounded border border-slate-200 p-5">
                <div><h3 className="text-sm font-bold">{employee.fullName}</h3><p className="mt-1 text-xs text-slate-500">{employee.email} · {employee.status}</p></div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {permissions.map(([permission, label]) => {
                    const enabled = employee.permissions.includes(permission);
                    const key = `${employee.accountId}:${permission}`;
                    return <label key={permission} className="flex cursor-pointer items-center gap-3 rounded border p-3 text-xs font-semibold"><input type="checkbox" checked={enabled} disabled={busy === key} onChange={() => toggle(employee, permission)} className="h-4 w-4"/><span>{label}</span></label>;
                  })}
                </div>
              </article>
            ))}
          </div>
        </DashboardSection>
      )}
    </DashboardLayout>
  );
}
