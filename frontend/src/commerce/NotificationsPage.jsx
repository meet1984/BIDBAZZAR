import React, { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { DashboardLayout, DashboardSection } from "../dashboard/DashboardLayout";
import api from "../lib/api";
import { errorMessage, formatDateTime } from "../lib/format";

export default function NotificationsPage() {
  const { user } = useAuth();
  const accountType = user?.accountType || "buyer";
  const role = accountType === "admin" || accountType === "admin_employee" ? "admin" : accountType;
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const { data } = await api.get("/notifications");
      setItems(data.data || []);
      setUnread(data.unreadCount || 0);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const mark = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  const markAll = async () => {
    try {
      await api.post("/notifications/mark-all-read");
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  return (
    <DashboardLayout role={role} title="Notifications" description="Persistent account and order updates.">
      <DashboardSection title={`${unread} unread`} description="Updates remain available until you mark them read.">
        {loading ? <LoadingState label="Loading notifications…"/> : error ? <ErrorState message={error} onRetry={load}/> : (
          <div className="space-y-3">
            <div className="flex justify-end"><button onClick={markAll} disabled={!unread} className="flex items-center gap-2 rounded border px-3 py-2 text-xs font-bold disabled:opacity-50"><CheckCheck size={15}/>Mark all read</button></div>
            {items.length === 0 && <p className="text-sm text-slate-500">No notifications yet.</p>}
            {items.map((item) => (
              <article key={item.id} className={`rounded border p-4 ${item.isRead ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50"}`}>
                <div className="flex gap-3">
                  <Bell size={17} className="mt-0.5 text-blue-600"/>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold">{item.payload?.linkUrl ? <a href={item.payload.linkUrl} className="hover:text-blue-700 hover:underline">{item.title}</a> : item.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{item.message}</p>
                    <p className="mt-2 text-[10px] text-slate-400">{formatDateTime(item.createdAt)}</p>
                  </div>
                  {!item.isRead && <button onClick={() => mark(item.id)} className="text-[11px] font-bold text-blue-700">Mark read</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </DashboardSection>
    </DashboardLayout>
  );
}
