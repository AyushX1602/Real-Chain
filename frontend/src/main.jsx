import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { UGFProvider } from "@tychilabs/react-ugf";
import App from "./App";
import { Web3Provider } from "./context/Web3Context";
import { UGFContextProvider } from "./context/UGFContext";
import { SmartAgentProvider } from "./context/SmartAgentContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./components/Toast";
import { PrivyShell } from "./context/PrivyBridge";
import { AgentProvider } from "./agents";
import ToastBridge from "./agents/core/ToastBridge";
import "./index.css";

// ── Provider tree ────────────────────────────────────────────────────────────
// Order (outermost → innermost):
//   PrivyShell         — Tier 3 / Task 6.1: optional embedded-wallet onboarding.
//                        No-op when VITE_PRIVY_APP_ID is unset, so the
//                        MetaMask-only flow keeps working untouched.
//   UGFProvider        — Tier 1/2: gives every child access to the UGF modal.
//   BrowserRouter      — routing.
//   Web3Provider       — wallet state (reads window.ethereum, which PrivyShell
//                        may have populated with an embedded wallet).
//   UGFContextProvider — wraps tx execution through UGF when toggle is on.
//   SmartAgentProvider — automation hooks.
//   ToastProvider      — UI notifications.
//   AgentProvider      — multi-agent orchestrator. Depends on Web3 / UGF /
//                        SmartAgent for service injection and on react-router
//                        for route sync, so it sits inside all of them.
//                        ToastBridge lives inside both AgentProvider and
//                        ToastProvider so it can subscribe to the bus and
//                        call toast().
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <PrivyShell>
        <UGFProvider mode="testnet">
          <BrowserRouter>
            <Web3Provider>
              <UGFContextProvider>
                <SmartAgentProvider>
                  <ToastProvider>
                    <AgentProvider>
                      <ToastBridge />
                      <App />
                    </AgentProvider>
                  </ToastProvider>
                </SmartAgentProvider>
              </UGFContextProvider>
            </Web3Provider>
          </BrowserRouter>
        </UGFProvider>
      </PrivyShell>
    </ThemeProvider>
  </React.StrictMode>
);
