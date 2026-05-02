import { createRoot } from "react-dom/client";
import App from "./App";
import ChangelogModal from "./components/ChangelogModal";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    {/* Global post-update changelog overlay — mounted as a root sibling
        so it surfaces regardless of which sub-app the user lands in. */}
    <ChangelogModal />
  </>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(err => console.warn('Service worker registration failed:', err));
  });
}
