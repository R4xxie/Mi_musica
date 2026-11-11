import { useEffect, useRef } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { useLibrary } from "./context/LibraryContext.jsx";
import { usePlayer } from "./context/PlayerContext.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import Player from "./components/Player.jsx";
import MobileNav from "./components/MobileNav.jsx";
import CookieBanner from "./components/CookieBanner.jsx";
import HomeView from "./views/HomeView.jsx";
import PlaylistView from "./views/PlaylistView.jsx";
import SearchView from "./views/SearchView.jsx";

// Compatibilidad con los enlaces antiguos #/genero/:slug
function GenreRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/playlist/genero-${encodeURIComponent(slug)}`} replace />;
}

/* ---------- Atajos de teclado globales ---------- */
function useKeyboardShortcuts() {
  const { togglePlay, toggleShuffle, cycleRepeatMode, toggleFade, toggleMute, seekBy } = usePlayer();

  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (e.key === "Escape") el.blur();
        return;
      }
      // Dentro del menú de modos, Espacio/Enter activan la opción enfocada
      if (el?.closest?.("#theme-picker")) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "/") {
        e.preventDefault();
        document.getElementById("search-input")?.focus();
      } else if (key === "s") toggleShuffle();
      else if (key === "r") cycleRepeatMode();
      else if (key === "t") toggleFade();
      else if (key === "m") toggleMute();
      else if (e.key === "ArrowRight") seekBy(5);
      else if (e.key === "ArrowLeft") seekBy(-5);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [togglePlay, toggleShuffle, cycleRepeatMode, toggleFade, toggleMute, seekBy]);
}

function MainView() {
  const { status } = useLibrary();
  const { pathname } = useLocation();
  const viewRef = useRef(null);

  useEffect(() => {
    if (viewRef.current) viewRef.current.scrollTop = 0;
  }, [pathname]);

  let content;
  if (status === "loading") {
    content = <p className="status">Cargando…</p>;
  } else if (status === "error") {
    content = (
      <div className="empty-state">
        <div className="empty-icon">⚠️</div>
        <h3>Error al cargar las canciones</h3>
        <p>Revisa la conexión o consola para más detalles.</p>
      </div>
    );
  } else {
    content = (
      <Routes>
        <Route path="/" element={<HomeView />} />
        <Route path="/playlist/:id" element={<PlaylistView />} />
        <Route path="/genero/:slug" element={<GenreRedirect />} />
        <Route path="/buscar" element={<SearchView />} />
        <Route path="/buscar/:q" element={<SearchView />} />
        <Route path="*" element={<HomeView />} />
      </Routes>
    );
  }

  return (
    <main id="view" className="view" tabIndex={-1} aria-live="polite" ref={viewRef}>
      {content}
    </main>
  );
}

export default function App() {
  useKeyboardShortcuts();

  return (
    <>
      <div className="ambient" aria-hidden="true"></div>

      <div className="app">
        <Sidebar />
        <div className="main">
          <Topbar />
          <MainView />
        </div>
      </div>

      <Player />
      <MobileNav />
      <CookieBanner />
    </>
  );
}

