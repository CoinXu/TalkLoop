import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { AppThemeProvider } from "./theme/AppThemeProvider";
import "./i18n";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppThemeProvider>
      <App />
    </AppThemeProvider>
  </React.StrictMode>,
);
