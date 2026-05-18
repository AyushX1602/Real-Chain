import React from "react";
import Icon from "./Icon";
import { useWeb3 } from "../context/Web3Context";

// ConnectGate — full-page prompt rendered when a route requires a wallet.
export default function ConnectGate({ title = "Connect your wallet", message = "Sign in with MetaMask to access this dashboard." }) {
  const { connect, connecting } = useWeb3();
  return (
    <div className="container">
      <div className="connect-prompt reveal">
        <div className="icon-wrap"><Icon name="wallet" size={28} /></div>
        <h2>{title}</h2>
        <p>{message}</p>
        <button className="btn btn-primary btn-lg btn-full" onClick={connect} disabled={connecting}>
          {connecting ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} /> Connecting…</> : <>Connect MetaMask <Icon name="arrowRight" size={14} /></>}
        </button>
        <div className="text-xs text-muted" style={{ marginTop: 14 }}>
          New here? <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" style={{ color: "var(--violet-300)" }}>Install MetaMask →</a>
        </div>
      </div>
    </div>
  );
}
