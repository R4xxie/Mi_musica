import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "../context/PlayerContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import Store from "../lib/storage.js";
import { THEMES } from "../lib/utils.js";
import { useActiveRoute } from "./Sidebar.jsx";
import { IconBack, IconCheck, IconFade, IconForward, IconPalette, IconSearch } from "./Icons.jsx";

const THEME_OPTIONS = [
  { heading: "Tema" },
  { id: "dark", emoji: "🌙", name: "Modo oscuro", desc: "Elegante y nocturno" },
  { id: "light", emoji: "☀️", name: "Modo claro", desc: "Limpio y luminoso" },
];

/* ---------- Modos de interfaz ---------- */
let themeTimer = null;
function applyTheme(name, animate) {
  const root = document.documentElement;
  if (animate) {
    root.classList.add("theme-switching");
    clearTimeout(themeTimer);
    themeTimer = setTimeout(() => root.classList.remove("theme-switching"), 700);
  }
  root.dataset.theme = name;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEMES[name].color);
}

function ThemePicker() {
  const { fadeEnabled, toggleFade } = usePlayer();
  const { showToast } = useToast();
  const [theme, setThemeState] = useState(() => {
    const saved = Store.prefs.get("theme", "dark");
    return THEMES[saved] ? saved : "dark";
  });
  const [open, setOpen] = useState(false);
  const pickerRef = useRef(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const firstRun = useRef(true);

  useEffect(() => {
    applyTheme(theme, !firstRun.current);
    firstRun.current = false;
  }, [theme]);

  // Al abrir, enfoca la opción marcada
  useEffect(() => {
    if (!open || !menuRef.current) return;
    const checked = menuRef.current.querySelector('[aria-checked="true"]') || menuRef.current.querySelector(".theme-option");
    checked?.focus();
  }, [open]);

  // Clic fuera / Escape cierran el menú
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (!pickerRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const chooseTheme = (name) => {
    setOpen(false);
    btnRef.current?.focus();
    if (name === theme) return;
    setThemeState(name);
    Store.prefs.set("theme", name);
    showToast(`${THEMES[name].label} activado`);
  };

  // Navegación con flechas dentro del menú
  const onMenuKeyDown = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    e.stopPropagation();
    const items = Array.from(menuRef.current.querySelectorAll(".theme-option"));
    const idx = items.indexOf(document.activeElement);
    const next = e.key === "ArrowDown" ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
    items[next].focus();
  };

  return (
    <div className="theme-picker" id="theme-picker" ref={pickerRef}>
      <button
        ref={btnRef}
        className="round-btn theme-btn"
        id="btn-theme"
        type="button"
        aria-haspopup="true"
        aria-expanded={String(open)}
        aria-controls="theme-menu"
        aria-label="Modos de interfaz"
        title="Modos de interfaz"
        onClick={() => setOpen((o) => !o)}
      >
        <IconPalette size={20} />
      </button>

      <div className="theme-menu" id="theme-menu" role="menu" aria-label="Modos de interfaz" hidden={!open} ref={menuRef} onKeyDown={onMenuKeyDown}>
        {THEME_OPTIONS.map((opt) =>
          opt.heading ? (
            <p key={opt.heading} className="theme-menu-heading">{opt.heading}</p>
          ) : (
            <button
              key={opt.id}
              className="theme-option"
              type="button"
              role="menuitemradio"
              aria-checked={String(theme === opt.id)}
              data-theme-option={opt.id}
              id={`theme-${opt.id}`}
              onClick={() => chooseTheme(opt.id)}
            >
              <span className={`theme-swatch swatch-${opt.id}`} aria-hidden="true">{opt.emoji}</span>
              <span className="theme-option-text">
                <span className="theme-option-name">{opt.name}</span>
                <span className="theme-option-desc">{opt.desc}</span>
              </span>
              <IconCheck className="theme-check" size={18} />
            </button>
          )
        )}

        <div className="theme-menu-sep" role="separator"></div>

        <button
          className="theme-option theme-option-toggle"
          type="button"
          role="menuitemcheckbox"
          aria-checked={String(fadeEnabled)}
          id="menu-fade"
          onClick={toggleFade}
        >
          <span className="theme-swatch swatch-fade" aria-hidden="true">
            <IconFade size={18} />
          </span>
          <span className="theme-option-text">
            <span className="theme-option-name">Modo transición</span>
            <span className="theme-option-desc">Crossfade de 5 s entre canciones</span>
          </span>
          <span className="switch" aria-hidden="true"></span>
        </button>
      </div>
    </div>
  );
}

/* ---------- Buscador ---------- */
function SearchBar() {
  const navigate = useNavigate();
  const route = useActiveRoute();
  const [value, setValue] = useState(route.q || "");
  const timer = useRef(null);

  // Sincroniza el campo con la URL (atrás / adelante, enlaces…)
  useEffect(() => {
    if (route.page === "search") setValue(route.q);
  }, [route.page, route.q]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const go = (q) => {
    if (q) navigate(`/buscar/${encodeURIComponent(q)}`, { replace: route.page === "search" && !!route.q });
    else navigate("/");
  };

  return (
    <form
      className="search"
      id="search-form"
      role="search"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        clearTimeout(timer.current);
        const q = value.trim();
        if (q) go(q);
      }}
    >
      <IconSearch className="search-icon" size={20} />
      <input
        id="search-input"
        type="search"
        placeholder="Buscar canciones, artistas o playlists"
        aria-label="Buscar"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => go(v.trim()), 250);
        }}
      />
      <kbd className="search-kbd" aria-hidden="true">/</kbd>
    </form>
  );
}

export default function Topbar() {
  const navigate = useNavigate();
  return (
    <header className="topbar">
      <div className="history-btns">
        <button className="round-btn" id="btn-back" type="button" aria-label="Atrás" onClick={() => navigate(-1)}>
          <IconBack size={22} />
        </button>
        <button className="round-btn" id="btn-forward" type="button" aria-label="Adelante" onClick={() => navigate(1)}>
          <IconForward size={22} />
        </button>
      </div>

      <SearchBar />

      <div className="topbar-actions">
        <ThemePicker />
      </div>
    </header>
  );
}

