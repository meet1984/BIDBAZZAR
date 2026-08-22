import React from "react";
import { useAuth } from "../auth/AuthContext";
import { Link } from "../components";
import { DashboardLayout, DashboardSection } from "../dashboard/DashboardLayout";

export default function ReviewsPage() {
  const { user } = useAuth();
  const accountType = user?.accountType || "buyer";
  const role = accountType === "admin" || accountType === "admin_employee" ? "admin" : accountType;
  return (
    <DashboardLayout role={role} title="Reviews" description="Reviews are available once an order is accepted or completed.">
      <DashboardSection title="Transaction-backed reviews" description="This protects ratings from unrelated or duplicate submissions.">
        <p className="text-sm leading-6 text-slate-600">Open an accepted order in the Order Center to review the other party. Each order permits one review in each direction.</p>
        {(accountType === "buyer" || accountType === "seller") && <Link href={`/${role}/orders`} className="mt-5 inline-flex rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white">Open accepted orders</Link>}
        {(accountType === "admin" || accountType === "admin_employee") && <Link href="/admin/operations" className="mt-5 inline-flex rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white">Open review moderation</Link>}
      </DashboardSection>
    </DashboardLayout>
  );
}
