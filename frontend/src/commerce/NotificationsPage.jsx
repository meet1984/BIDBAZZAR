import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, Bell, CheckCheck, Loader2, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useNotificationCount } from "../hooks/useNotificationCount";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { DashboardLayout, DashboardSection } from "../dashboard/DashboardLayout";
import api from "../lib/api";
import { errorMessage, formatDateTime } from "../lib/format";

export default function NotificationsPage() {
  const { user } = useAuth();
  const { refresh: refreshGlobalCount } = useNotificationCount();
  const accountType = user?.accountType || "buyer";
  const role = accountType === "admin" || accountType === "admin_employee" ? "admin" : accountType;
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [markingIds, setMarkingIds] = useState(new Set());
  const [isMarkingAll, setIsMarkingAll] = useState(false);

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

  useEffect(() => {
    load();
  }, [load]);

  const mark = async (id) => {
    if (markingIds.has(id)) return;
    setActionError("");

    // Optimistic update
    const previousItems = [...items];
    const previousUnread = unread;
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
    );
    setUnread((prev) => Math.max(0, prev - 1));
    setMarkingIds((prev) => new Set(prev).add(id));

    try {
      await api.patch(`/notifications/${id}/read`);
      void refreshGlobalCount();
    } catch (requestError) {
      // Revert on failure
      setItems(previousItems);
      setUnread(previousUnread);
      setActionError(errorMessage(requestError, "Failed to mark notification as read."));
    } finally {
      setMarkingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const markAll = async () => {
    if (isMarkingAll || unread === 0) return;
    setActionError("");
    setIsMarkingAll(true);

    const previousItems = [...items];
    const previousUnread = unread;
    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnread(0);

    try {
      await api.post("/notifications/mark-all-read");
      void refreshGlobalCount();
    } catch (requestError) {
      setItems(previousItems);
      setUnread(previousUnread);
      setActionError(errorMessage(requestError, "Failed to mark all notifications as read."));
    } finally {
      setIsMarkingAll(false);
    }
  };

  return (
    <DashboardLayout role={role} title="Notifications" description="Persistent account and order updates.">
      <DashboardSection title={`${unread} unread`} description="Updates remain available until you mark them read.">
        {loading ? (
          <LoadingState label="Loading notifications…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <div className="space-y-3">
            {actionError && (
              <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-red-500" />
                  <span>{actionError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActionError("")}
                  className="text-red-500 hover:text-red-700"
                  aria-label="Dismiss error"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={markAll}
                disabled={!unread || isMarkingAll}
                className="flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                {isMarkingAll ? <Loader2 size={15} className="animate-spin" /> : <CheckCheck size={15} />}
                Mark all read
              </button>
            </div>
            {items.length === 0 && <p className="text-sm text-slate-500">No notifications yet.</p>}
            {items.map((item) => {
              const isMarkingThis = markingIds.has(item.id);
              return (
                <article
                  key={item.id}
                  className={`rounded-lg border p-4 transition ${
                    item.isRead ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50/70"
                  }`}
                >
                  <div className="flex gap-3">
                    <Bell size={17} className={`mt-0.5 shrink-0 ${item.isRead ? "text-slate-400" : "text-blue-600"}`} />
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-slate-900">
                        {item.payload?.linkUrl ? (
                          <a href={item.payload.linkUrl} className="hover:text-blue-700 hover:underline">
                            {item.title}
                          </a>
                        ) : (
                          item.title
                        )}
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{item.message}</p>
                      <p className="mt-2 text-[10px] text-slate-400">{formatDateTime(item.createdAt)}</p>
                    </div>
                    {!item.isRead && (
                      <button
                        type="button"
                        onClick={() => mark(item.id)}
                        disabled={isMarkingThis}
                        className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-blue-700 hover:underline disabled:opacity-50"
                      >
                        {isMarkingThis ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            <span>Marking…</span>
                          </>
                        ) : (
                          "Mark read"
                        )}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </DashboardSection>
    </DashboardLayout>
  );
}

