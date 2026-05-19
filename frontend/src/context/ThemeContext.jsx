import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// ThemeContext — centralised dark/light switch.
//
// Storage     : localStorage["realchain-theme"]   ("light" | "dark")
// Default     : "light" (deterministic — never reads prefers-color-scheme)
// Application : data-theme attribute on <html>
//
// A small synchronous bootstrap script in `index.html` already sets the
// attribute before React mounts so token resolution never flashes the wrong
// palette on first paint. This context just keeps React state and the DOM
// attribute in sync, and persists the choice on every change.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = "realchain-theme";
const VALID = new Set(["light", "dark"]);

function readSaved() {
  if (typeof window === "undefined") return "light";
  try {
    const v = window.localStorage?.getItem(KEY);
    return VALID.has(v) ? v : "light";
  } catch {
    return "light";
  }
}

const ThemeCtx = createContext({ theme: "light", setTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    // The HTML bootstrap script may already have read storage and set the
    // attribute. Mirror that into React state so the first render matches.
    if (typeof document !== "undefined") {
      const fromAttr = document.documentElement.getAttribute("data-theme");
      if (VALID.has(fromAttr)) return fromAttr;
    }
    return readSaved();
  });

  // Apply + persist on every change.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", theme);
    try { window.localStorage?.setItem(KEY, theme); } catch { /* private mode */ }
  }, [theme]);

  // Cross-tab sync — when another tab changes the preference, follow.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onStorage = (e) => {
      if (e.key !== KEY) return;
      const next = VALID.has(e.newValue) ? e.newValue : "light";
      setThemeState(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((next) => {
    setThemeState(VALID.has(next) ? next : "light");
  }, []);

  return (
    <ThemeCtx.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

export default ThemeProvider;
