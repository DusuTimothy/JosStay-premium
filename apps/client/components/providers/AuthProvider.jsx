"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, setApiAuthHandlers } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | authenticated | unauthenticated
  const refreshPromiseRef = useRef(null);

  const applySession = useCallback((data) => {
    const token = data?.token || data?.accessToken || null;
    const nextUser = data?.user || null;
    setAccessToken(token);
    setUser(nextUser);
    setStatus(token && nextUser ? "authenticated" : "unauthenticated");
    return { token, user: nextUser };
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const refresh = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const promise = (async () => {
      try {
        const res = await api.post("/api/auth/refresh", {});
        return applySession(res?.data);
      } catch {
        clearSession();
        return { token: null, user: null };
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = promise;
    return promise;
  }, [applySession, clearSession]);

  useEffect(() => {
    setApiAuthHandlers({
      getAccessToken: () => accessToken,
      refreshSession: refresh,
    });
  }, [accessToken, refresh]);

  useEffect(() => {
    let active = true;
    (async () => {
      const session = await refresh();
      if (!active) return;
      // refresh() already sets state
      if (!session?.token) setStatus("unauthenticated");
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  const login = useCallback(async ({ email, password }) => {
    const res = await api.post("/api/auth/login", { email, password });
    return applySession(res?.data);
  }, [applySession]);

  const register = useCallback(async ({ name, email, password }) => {
    const res = await api.post("/api/auth/register", { name, email, password });
    if (res?.data?.requiresEmailVerification) {
      clearSession();
      return { ...res.data, requiresEmailVerification: true };
    }
    return applySession(res?.data);
  }, [applySession, clearSession]);

  const loginWithGoogle = useCallback(async ({ credential }) => {
    const res = await api.post("/api/auth/google", { credential });
    return applySession(res?.data);
  }, [applySession]);

  const requestEmailVerification = useCallback(async (email) => {
    return api.post("/api/auth/verify-email/request", { email });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout", {});
    } catch {
      // Always clear local session even if server logout fails.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      status,
      isAuthenticated: status === "authenticated" && !!accessToken,
      isLoading: status === "loading",
      login,
      register,
      loginWithGoogle,
      requestEmailVerification,
      logout,
      refresh,
      setSession: applySession,
      clearSession,
      ApiError,
    }),
    [user, accessToken, status, login, register, loginWithGoogle, requestEmailVerification, logout, refresh, applySession, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};