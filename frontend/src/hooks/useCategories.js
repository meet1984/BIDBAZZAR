import { useEffect, useState } from "react";
import api from "../lib/api";

const CACHE_KEY = "bidmylot_categories_v1";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function readStorageCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.items)) {
      const isFresh = Date.now() - (parsed.timestamp || 0) < CACHE_TTL_MS;
      return { items: parsed.items, isFresh };
    }
  } catch {
    // Ignore JSON parsing or storage read errors
  }
  return null;
}

function writeStorageCache(items) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        items,
      }),
    );
  } catch {
    // Ignore storage quota errors
  }
}

const initialCache = readStorageCache();
let categoriesCache = initialCache ? initialCache.items : null;
let fetchPromise = null;

export function useCategories() {
  const [categories, setCategories] = useState(categoriesCache || []);
  const [loading, setLoading] = useState(!categoriesCache);
  const [error, setError] = useState(null);

  const fetchCategories = async (force = false) => {
    // If not forced, check memory cache and storage freshness
    if (!force && categoriesCache) {
      const storage = readStorageCache();
      if (storage?.isFresh) {
        setCategories(categoriesCache);
        setLoading(false);
        return;
      }
    }

    if (!categoriesCache) {
      setLoading(true);
    }
    setError(null);

    try {
      if (!fetchPromise || force) {
        fetchPromise = api.get("/categories");
      }
      const res = await fetchPromise;
      const items = res.data?.items || [];
      categoriesCache = items;
      writeStorageCache(items);
      setCategories(items);
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to load categories";
      setError(msg);
    } finally {
      setLoading(false);
      fetchPromise = null;
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return {
    categories,
    loading,
    error,
    refresh: () => fetchCategories(true),
  };
}
