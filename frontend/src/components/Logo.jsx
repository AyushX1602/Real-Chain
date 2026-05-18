import React from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Logo — RealChain mark + wordmark.
//
// Mark: Stacked layer glyph (≈ tokenized / fractional) with a chain link spine.
// Wordmark: "RealChain" set in semibold Inter; gradient on the "Real" portion.
// ─────────────────────────────────────────────────────────────────────────────

export function LogoMark({ size = 32, className = "", title = "RealChain" }) {
  const id = React.useId();
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={title}
      className={className}
    >
      <defs>
        <linearGradient id={`${id}-grad`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%"  stopColor="#A78BFA" />
          <stop offset="50%" stopColor="#7C6EFA" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%"  stopColor="#7C6EFA" stopOpacity="1" />
          <stop offset="100%" stopColor="#7C6EFA" stopOpacity="0.5" />
        </linearGradient>
      </defs>

      {/* Rounded square backdrop */}
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill={`url(#${id}-grad)`} />

      {/* Stacked layers / building silhouette */}
      <g fill="white" fillOpacity="0.95">
        <path d="M16 6.5 24 11l-8 4.5L8 11l8-4.5Z" />
        <path d="M8 14.5 16 19l8-4.5v3.2L16 22.2 8 17.7v-3.2Z" fillOpacity="0.7" />
        <path d="M8 19 16 23.5 24 19v3L16 26.5 8 22v-3Z" fillOpacity="0.45" />
      </g>
    </svg>
  );
}

export function Logo({ size = 32, showWordmark = true, className = "" }) {
  return (
    <span className={`logo ${className}`}>
      <LogoMark size={size} />
      {showWordmark && (
        <span className="logo-wordmark">
          <span className="logo-real">Real</span>
          <span className="logo-chain">Chain</span>
        </span>
      )}
    </span>
  );
}

export default Logo;
