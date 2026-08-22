import { useEffect, useState } from "react";
import api from "../lib/api";

let categoriesCache = null;
let fetchPromise = null;

export function useCategories() {
  const [categories, setCategories] = useState(categoriesCache || []);
  const [loading, setLoading] = useState(!categoriesCache);
  const [error, setError] = useState(null);

  const fetchCategories = async (force = false) => {
    if (!force && categoriesCache) {
      setCategories(categoriesCache);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (!fetchPromise || force) {
        fetchPromise = api.get("/categories");
      }
      const res = await fetchPromise;
      const items = res.data?.items || [];
      categoriesCache = items;
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
