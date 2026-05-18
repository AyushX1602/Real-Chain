import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { Web3Provider } from "./context/Web3Context";
import { UGFContextProvider } from "./context/UGFContext";
import { SmartAgentProvider } from "./context/SmartAgentContext";
import { ToastProvider } from "./components/Toast";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Web3Provider>
        <UGFContextProvider>
          <SmartAgentProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </SmartAgentProvider>
        </UGFContextProvider>
      </Web3Provider>
    </BrowserRouter>
  </React.StrictMode>
);
