import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";
import Logo from "../components/Logo";

const ROLE_OPTIONS = [
  {
    id: "owner",
    label: "Owner",
    icon: "building",
    title: "Property owner",
    body: "Set a receiving wallet, launch properties, deposit rent, and manage tokenized supply.",
  },
  {
    id: "tenant",
    label: "Rent payer",
    icon: "receipt",
    title: "Rent payer",
    body: "Pay USDC rent, track receipts, and keep wallet gas simple.",
  },
];

export default function AuthPage({ mode = "login" }) {
  const isSignup = mode === "signup";
  const navigate = useNavigate();
  const { login, signup, loading, error, dashboardForRole } = useAuth();
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    role: "owner",
  });
  const [localError, setLocalError] = useState("");

  const selectedRole = useMemo(
    () => ROLE_OPTIONS.find((r) => r.id === form.role) || ROLE_OPTIONS[0],
    [form.role]
  );

  function update(key, value) {
    setLocalError("");
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalError("");

    if (!form.email.trim() || !form.password) {
      setLocalError("Email and password are required.");
      return;
    }
    if (isSignup && form.password !== form.confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    try {
      const user = isSignup
        ? await signup(form.email, form.password, form.role)
        : await login(form.email, form.password);
      navigate(dashboardForRole(user.role), { replace: true });
    } catch {
      // AuthContext already exposes a user-facing error.
    }
  }

  return (
    <div className="container auth-shell reveal">
      <section className="auth-panel" aria-label={isSignup ? "Create account" : "Log in"}>
        <div className="auth-copy">
          <Logo size={42} />
          <div>
            <span className="lp-hero-eyebrow auth-eyebrow">
              <span className="lp-hero-eyebrow-dot" />
              {isSignup ? "new account" : "welcome back"}
            </span>
            <h1 className="auth-title">
              {isSignup ? "Create your RealChain account" : "Log in to RealChain"}
            </h1>
            <p className="auth-sub">
              Use email and password for the app session, then connect a wallet
              only when a dashboard needs an on-chain action.
            </p>
          </div>

          <div className="auth-role-preview">
            <span className="auth-role-icon"><Icon name={selectedRole.icon} size={18} /></span>
            <div>
              <strong>{selectedRole.title}</strong>
              <p>{selectedRole.body}</p>
            </div>
          </div>
        </div>

        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="auth-card-head">
            <h2>{isSignup ? "Sign up" : "Log in"}</h2>
            <p>{isSignup ? "Pick a role now. You can still connect any wallet later." : "Your role decides the dashboard we open first."}</p>
          </div>

          {isSignup && (
            <div className="auth-role-grid" role="radiogroup" aria-label="Choose your role">
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  role="radio"
                  aria-checked={form.role === role.id}
                  className={`auth-role-card ${form.role === role.id ? "is-active" : ""}`}
                  onClick={() => update("role", role.id)}
                >
                  <Icon name={role.icon} size={16} />
                  <span>{role.label}</span>
                </button>
              ))}
            </div>
          )}

          <label className="form-group">
            <span className="form-label">Email</span>
            <div className="form-input-prefix">
              <span className="prefix"><Icon name="user" size={13} /></span>
              <input
                className="form-input"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
          </label>

          <label className="form-group">
            <span className="form-label">Password</span>
            <div className="form-input-prefix">
              <span className="prefix"><Icon name="lock" size={13} /></span>
              <input
                className="form-input"
                type="password"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="At least 6 characters"
                autoComplete={isSignup ? "new-password" : "current-password"}
              />
            </div>
          </label>

          {isSignup && (
            <label className="form-group">
              <span className="form-label">Confirm password</span>
              <div className="form-input-prefix">
                <span className="prefix"><Icon name="shield" size={13} /></span>
                <input
                  className="form-input"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => update("confirmPassword", e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                />
              </div>
            </label>
          )}

          {(localError || error) && (
            <div className="auth-error" role="alert">
              <Icon name="alert" size={14} />
              {localError || error}
            </div>
          )}

          <button className="btn btn-primary btn-lg btn-full" type="submit" disabled={loading}>
            {loading
              ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} /> Please wait</>
              : isSignup
                ? <>Create account <Icon name="arrowRight" size={14} /></>
                : <>Log in <Icon name="arrowRight" size={14} /></>}
          </button>

          <div className="auth-switch">
            {isSignup ? (
              <>Already have an account? <Link to="/login">Log in</Link></>
            ) : (
              <>Need an account? <Link to="/signup">Sign up</Link></>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
