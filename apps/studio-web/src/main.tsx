import { tolgee } from '@workspace/studio-core';
import { createRoot } from "react-dom/client";
import { TolgeeProvider } from "@tolgee/react";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <TolgeeProvider tolgee={tolgee} fallback={null}>
    <App />
  </TolgeeProvider>,
);

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => {
      void reg.unregister();
    });
  }).catch((err) => {
    console.warn('[sw] Failed to clean up service workers:', err);
  });
}
