import { useCallback, useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// useWatchlist — minimal localStorage-backed favorites hook for the marketplace.
// Returns the current list of property ids and three pure helpers. No backend
// round-trip yet; the data model is forward-compatible with a future
// `User.watchlist` field on the Express API.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "realchain.watchlist.v1";

function readStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

function writeStored(list) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch { /* quota or private mode — ignore */ }
}

export default function useWatchlist() {
  const [ids, setIds] = useState(() => (typeof window === "undefined" ? [] : readStored()));

  // Sync across tabs/windows so favouriting on one device updates everywhere.
  useEffect(() => {
    function handleStorage(e) {
      if (e.key !== STORAGE_KEY) return;
      setIds(readStored());
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const has = useCallback((id) => ids.includes(Number(id)), [ids]);

  const toggle = useCallback((id) => {
    setIds((prev) => {
      const n = Number(id);
      const next = prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n];
      writeStored(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setIds([]);
    writeStored([]);
  }, []);

  return { ids, has, toggle, clear, count: ids.length };
}
