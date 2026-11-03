import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./style.css";
import { initializeVkBridge, isVkEnvironment } from "./vkBridge";

console.info("[VK DEBUG] Application startup.");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

console.info(
  `[VK DEBUG] Environment detected: ${isVkEnvironment() ? "VK" : "browser"}.`,
);

void initializeVkBridge().catch((error: unknown) => {
  console.error(
    "[VK DEBUG] Unexpected VK Bridge startup error; application remains available.",
    error instanceof Error ? error.name : "Unknown error",
  );
});
