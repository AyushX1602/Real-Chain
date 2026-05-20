import React from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Icon — Lucide-inspired SVG icon set, inline.
//
// All icons are 24×24 on a 24-grid, stroke 2, currentColor by default. They
// scale to whatever font-size or `size` prop is passed and respect text color
// from the parent — drop them anywhere a glyph is needed.
//
// Usage: <Icon name="wallet" size={18} />
//        <Icon name="claim" className="text-accent" />
// ─────────────────────────────────────────────────────────────────────────────

const PATHS = {
  // Navigation
  home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></>,
  coins: <><circle cx="9" cy="9" r="6"/><path d="M15.5 6.5a6 6 0 1 1-6 9"/><path d="M7 9h2a1.5 1.5 0 0 1 0 3H7m1 0v1.5"/><path d="M8 7.5V9"/></>,
  building: <><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h.01M9 11h.01M9 15h.01M15 7h.01M15 11h.01M15 15h.01"/><path d="M10 21v-4h4v4"/></>,
  layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></>,

  // Actions
  bolt: <><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></>,
  claim: <><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></>,
  check: <><path d="M5 12.5 9.5 17 19 7"/></>,
  close: <><path d="M6 6l12 12M18 6 6 18"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  minus: <><path d="M5 12h14"/></>,
  refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></>,
  external: <><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
  send: <><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7Z"/></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff: <><path d="M9.9 4.24A10.5 10.5 0 0 1 12 4c6.5 0 10 7 10 7a17 17 0 0 1-3.05 3.95M6.61 6.6A17 17 0 0 0 2 11s3.5 7 10 7c1.7 0 3.16-.41 4.4-1.05"/><path d="M14.12 14.12a3 3 0 0 1-4.24-4.24"/><path d="m2 2 20 20"/></>,

  // Wallet & money
  wallet: <><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M16 14h2"/></>,
  card: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/></>,
  dollar: <><path d="M12 2v20"/><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
  drop: <><path d="M12 2.7s5.5 5.5 5.5 10.3a5.5 5.5 0 0 1-11 0C6.5 8.2 12 2.7 12 2.7Z"/></>,
  spark: <><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6 7.7 7.7M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/></>,
  trending: <><path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/></>,

  // Status & feedback
  alert: <><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z"/></>,
  info: <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>,

  // Arrows
  arrowRight: <><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>,
  arrowDown: <><path d="M12 5v14"/><path d="m5 12 7 7 7-7"/></>,
  chevronRight: <><path d="m9 6 6 6-6 6"/></>,
  chevronDown: <><path d="m6 9 6 6 6-6"/></>,
  chevronUp: <><path d="m6 15 6-6 6 6"/></>,

  // UI
  menu: <><path d="M3 6h18M3 12h18M3 18h18"/></>,
  dots: <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></>,
  filter: <><path d="M3 5h18l-7 9v6l-4-2v-4L3 5Z"/></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></>,

  // Domain
  pin: <><path d="M12 22s7-7.5 7-13a7 7 0 0 0-14 0c0 5.5 7 13 7 13Z"/><circle cx="12" cy="9" r="2.5"/></>,
  globe: <><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></>,
  receipt: <><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2"/><path d="M8 7h8M8 11h8M8 15h5"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  users: <><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8"/><path d="M22 21a7 7 0 0 0-5-6.7"/></>,
  history: <><path d="M3 12a9 9 0 1 0 9-9c-2.5 0-4.7 1-6.4 2.6L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></>,
  fire: <><path d="M12 22a7 7 0 0 0 7-7c0-3-2-5-3.5-7-1.4-2-2-3.5-1.5-6-3 1-7 4-7 9 0 .8.1 1.5.3 2.2A4 4 0 0 1 5 12a5 5 0 0 0 0 5 7 7 0 0 0 7 5Z"/></>,
  star: <><path d="m12 3 2.9 5.9 6.6.9-4.7 4.7 1.1 6.5L12 18l-5.9 3 1.1-6.5L2.5 9.8l6.6-.9L12 3Z"/></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></>,
  link: <><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></>,
  power: <><path d="M12 2v10"/><path d="M5.6 7.6a9 9 0 1 0 12.8 0"/></>,
  faucet: <><path d="M14 6v4M10 6v4"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M5 14a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v0"/><path d="M3 14h18"/><path d="M12 14v4"/><path d="M9 22h6l-1-4h-4l-1 4Z"/></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a2 2 0 0 0 3.4 0"/></>,
  clock: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></>,
  trophy: <><path d="M6 9H4V5h2M18 9h2V5h-2"/><path d="M4 5h16"/><path d="M12 22v-4"/><path d="M8 22h8"/><path d="M6 5a6 6 0 0 0 12 0"/><path d="M6 13a6 6 0 0 0 6 5 6 6 0 0 0 6-5"/></>,
};

export default function Icon({ name, size = 18, strokeWidth = 2, className = "", style, "aria-hidden": ariaHidden = true, ...rest }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon ${className}`}
      style={{ flexShrink: 0, ...style }}
      aria-hidden={ariaHidden}
      {...rest}
    >
      {path}
    </svg>
  );
}
