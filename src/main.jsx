import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { ToastProvider } from "./context/ToastContext.jsx";
import { LibraryProvider } from "./context/LibraryContext.jsx";
import { PlayerProvider } from "./context/PlayerContext.jsx";
import App from "./App.jsx";
import "./styles.css";

// HashRouter (#/...) → funciona en GitHub Pages sin configurar redirecciones
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HashRouter>
      <ToastProvider>
        <LibraryProvider>
          <PlayerProvider>
            <App />
          </PlayerProvider>
        </LibraryProvider>
      </ToastProvider>
    </HashRouter>
  </StrictMode>
);

