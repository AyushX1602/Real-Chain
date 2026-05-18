import React from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Logo — RealChain mark + wordmark, restyled in the Positivus visual language.
//
// Mark: a flat black square with the lime "asterisk" cluster used as the
//       Positivus signifier, repurposed as a stacked layer/chain link.
// Wordmark: "RealChain" set in Space Grotesk medium, all black.
// ─────────────────────────────────────────────────────────────────────────────

export function LogoMark({ size = 36, className = "", title = "RealChain" }) {
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
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#191A23" stroke="#191A23" strokeWidth="1" />
      {/* Stacked tokenization glyph in lime */}
      <g fill="#B9FF66">
        <path d="M16 7 24 11.5l-8 4.5-8-4.5L16 7Z" />
        <path d="M8 15 16 19.5l8-4.5v3L16 22.5 8 18v-3Z" fillOpacity="0.85" />
        <path d="M8 19.5 16 24l8-4.5v2.5L16 27 8 22v-2.5Z" fillOpacity="0.6" />
      </g>
    </svg>
  );
}

export function Logo({ size = 36, showWordmark = true, className = "" }) {
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
