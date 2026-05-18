import React from "react";

// Accessible switch with keyboard + screen-reader support.
// Wrapped <label> so clicking the label toggles. role="switch" + aria-checked.

export default function Switch({ checked, onChange, label, disabled = false, id }) {
  function handleKey(e) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (!disabled) onChange(!checked);
    }
  }
  return (
    <label
      className={`switch ${checked ? "is-on" : ""}`}
      htmlFor={id}
      onKeyDown={handleKey}
      tabIndex={0}
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
        tabIndex={-1}
      />
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
      {label && <span className="text-sm font-semibold">{label}</span>}
    </label>
  );
}
