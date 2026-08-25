import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { useAuth } from "../auth/AuthContext";

const STORAGE_KEY = "bidmylot_unread_notifications";
const POLL_INTERVAL_MS = 30_000;

function readStorageCount() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const num = Number(raw);
      if (!Number.isNaN(num)) return num;
    }
  } catch {
    // ignore
  }
  return 0;
}

function writeStorageCount(count) {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(count));
  } catch {
    // ignore
  }
}

// Module-level singleton state
let globalCount = readStorageCount();
let subscribers = new Set();
let pollTimer = null;
let isFetching = false;

async function fetchGlobalCount() {
  if (isFetching) return;
  isFetching = true;
  try {
    const { data } = await api.get("/notifications?limit=1");
    if (typeof data?.unreadCount === "number") {
      globalCount = data.unreadCount;
      writeStorageCount(globalCount);
      subscribers.forEach((callback) => callback(globalCount));
    }
  } catch {
    // Silently ignore notification polling errors
  } finally {
    isFetching = false;
  }
}

function startPolling() {
  if (pollTimer) return;
  void fetchGlobalCount();
  pollTimer = setInterval(fetchGlobalCount, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function useNotificationCount() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(globalCount);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const handleUpdate = (newCount) => setUnreadCount(newCount);
    subscribers.add(handleUpdate);

    if (subscribers.size === 1) {
      startPolling();
    }

    return () => {
      subscribers.delete(handleUpdate);
      if (subscribers.size === 0) {
        stopPolling();
      }
    };
  }, [user]);

  const refresh = useCallback(() => {
    return fetchGlobalCount();
  }, []);

  return {
    unreadCount,
    refresh,
  };
}

export function clearNotificationCache() {
  globalCount = 0;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  subscribers.forEach((callback) => callback(0));
}
