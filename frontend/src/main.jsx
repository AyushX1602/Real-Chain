import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { Web3Provider } from "./context/Web3Context";
import { UGFContextProvider } from "./context/UGFContext";
import { SmartAgentProvider } from "./context/SmartAgentContext";
import { ToastProvider } from "./components/Toast";
import { AgentProvider } from "./agents";
import ToastBridge from "./agents/core/ToastBridge";
import "./index.css";

// ── Provider tree ────────────────────────────────────────────────────────────
// Order matters:
//   BrowserRouter → Web3 → UGF → SmartAgent → Toast → AgentProvider
// AgentProvider depends on Web3, UGF, SmartAgent for service injection and on
// react-router for route sync, so it sits inside all of them. ToastBridge
// lives inside both AgentProvider and ToastProvider so it can subscribe to
// the bus and call toast().
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
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
  </React.StrictMode>
);
