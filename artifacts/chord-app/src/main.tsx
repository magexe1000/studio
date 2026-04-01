import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

import { StatusBar } from '@capacitor/status-bar';
StatusBar.hide().catch(() => {});

createRoot(document.getElementById("root")!).render(<App />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(err => console.warn('Service worker registration failed:', err));
  });
}
