import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api, { setAccessToken } from "../lib/api";

const AuthContext = createContext(null);
let restorePromise = null;

async function restoreSession() {
  restorePromise ??= api
    .post("/auth/refresh")
    .then((response) => response.data)
    .catch(() => {
      restorePromise = null;
      return null;
    });
  return restorePromise;
}

function normalizeUser(userData) {
  if (!userData) return null;
  const accountType = userData.accountType || userData.role || "buyer";
  const isAdmin = accountType === "admin" || accountType === "admin_employee";
  const isSeller = accountType === "seller";
  const isBuyer = accountType === "buyer";

  return {
    ...userData,
    accountType,
    role: accountType,
    isBuyer,
    isSeller,
    isAdmin,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const updateSession = useCallback((accessToken, userData) => {
    const normalized = normalizeUser(userData);
    setAccessToken(accessToken);
    setUser(normalized);
  }, []);

  useEffect(() => {
    let active = true;
    const hasTabSession = sessionStorage.getItem("bidmylot_tab_session") === "active";
    const hasPersistentSession = localStorage.getItem("bidmylot_remember_me") === "true";

    if (!hasTabSession && !hasPersistentSession) {
      setAccessToken(null);
      setUser(null);
      setInitializing(false);
      return () => {
        active = false;
      };
    }

    restoreSession().then((session) => {
      if (!active) return;
      if (session?.accessToken && session?.user) {
        const normalized = normalizeUser(session.user);
        if (normalized.isAdmin) {
          localStorage.removeItem("bidmylot_remember_me");
        }
        sessionStorage.setItem("bidmylot_tab_session", "active");
        setAccessToken(session.accessToken);
        setUser(normalized);
      } else {
        sessionStorage.removeItem("bidmylot_tab_session");
        localStorage.removeItem("bidmylot_remember_me");
        setAccessToken(null);
      }
      setInitializing(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      initializing,
      updateSession,
      async login(credentials, endpoint = "/auth/login") {
        const { data } = await api.post(endpoint, credentials);
        if (data.otpRequired) {
          return data;
        }
        const normalized = normalizeUser(data.user);
        sessionStorage.setItem("bidmylot_tab_session", "active");
        if (credentials.rememberMe && !normalized?.isAdmin) {
          localStorage.setItem("bidmylot_remember_me", "true");
        } else {
          localStorage.removeItem("bidmylot_remember_me");
        }
        setAccessToken(data.accessToken);
        setUser(normalized);
        return { ...data, user: normalized };
      },
      async verifyOtp({ challengeId, otp }) {
        const { data } = await api.post("/auth/login/verify-otp", { challengeId, otp });
        const normalized = normalizeUser(data.user);
        sessionStorage.setItem("bidmylot_tab_session", "active");
        if (data.rememberMe && !normalized?.isAdmin) {
          localStorage.setItem("bidmylot_remember_me", "true");
        } else {
          localStorage.removeItem("bidmylot_remember_me");
        }
        setAccessToken(data.accessToken);
        setUser(normalized);
        return { ...data, user: normalized };
      },
      async resendOtp({ challengeId }) {
        const { data } = await api.post("/auth/login/resend-otp", { challengeId });
        return data;
      },
      async register(details, endpoint = "/auth/register") {
        const { data } = await api.post(endpoint, details);
        return data;
      },
      async logout() {
        try {
          await api.post("/auth/logout");
        } finally {
          sessionStorage.removeItem("bidmylot_tab_session");
          localStorage.removeItem("bidmylot_remember_me");
          setAccessToken(null);
          setUser(null);
          restorePromise = null;
        }
      },
    }),
    [initializing, user, updateSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
