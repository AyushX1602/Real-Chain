import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BACKEND_URL } from "../config/contracts";

const AuthContext = createContext(null);
const TOKEN_KEY = "realchain-auth-token";

function dashboardForRole(role) {
  if (role === "owner") return "/admin";
  if (role === "tenant") return "/investor";
  return "/marketplace";
}

function decodeJwtPayload(token) {
  try {
    const payload = String(token).split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
}

function userFromToken(token) {
  const payload = decodeJwtPayload(token);
  if (!payload?.sub || !payload?.email || !payload?.role) return null;
  if (payload.exp && payload.exp * 1000 < Date.now()) return null;
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    assetWallet: payload.assetWallet || "",
  };
}

async function parseApiError(response) {
  try {
    const data = await response.json();
    return data?.error || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try { return window.localStorage.getItem(TOKEN_KEY) || ""; }
    catch { return ""; }
  });
  const [user, setUser] = useState(() => token ? userFromToken(token) : null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState(null);

  const saveSession = useCallback((nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    try { window.localStorage.setItem(TOKEN_KEY, nextToken); } catch { /* private mode */ }
  }, []);

  const logout = useCallback(() => {
    setToken("");
    setUser(null);
    setError(null);
    try { window.localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
  }, []);

  useEffect(() => {
    let alive = true;
    if (!token) {
      setLoading(false);
      return () => { alive = false; };
    }

    const optimistic = userFromToken(token);
    if (!optimistic) {
      logout();
      setLoading(false);
      return () => { alive = false; };
    }
    setUser((prev) => prev || optimistic);

    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!alive) return;
        if (!r.ok) throw new Error(await parseApiError(r));
        const data = await r.json();
        setUser(data.user || optimistic);
        setError(null);
      } catch (err) {
        if (!alive) return;
        setError(err.message || "Session check failed");
        logout();
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [token, logout]);

  const requestAuth = useCallback(async (path, payload) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${BACKEND_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(await parseApiError(r));
      const data = await r.json();
      if (!data?.token || !data?.user) throw new Error("Auth response missing token");
      saveSession(data.token, data.user);
      return data.user;
    } catch (err) {
      setError(err.message || "Authentication failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [saveSession]);

  const login = useCallback((email, password) => (
    requestAuth("/api/auth/login", { email, password })
  ), [requestAuth]);

  const signup = useCallback((email, password, role) => (
    requestAuth("/api/auth/signup", { email, password, role })
  ), [requestAuth]);

  const updateProfile = useCallback(async (patch) => {
    if (!token) throw new Error("Not authenticated");
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${BACKEND_URL}/api/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error(await parseApiError(r));
      const data = await r.json();
      if (!data?.token || !data?.user) throw new Error("Profile response missing token");
      saveSession(data.token, data.user);
      return data.user;
    } catch (err) {
      setError(err.message || "Profile update failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token, saveSession]);

  const value = useMemo(() => ({
    token,
    user,
    loading,
    error,
    isAuthenticated: Boolean(user && token),
    login,
    signup,
    updateProfile,
    logout,
    dashboardForRole,
  }), [token, user, loading, error, login, signup, updateProfile, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
