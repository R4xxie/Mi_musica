/* ---------- Utilidades compartidas ---------- */

// SVG de respaldo cuando la carátula no existe o falla al cargar
export const FALLBACK_COVER = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#2a1226"/>
        <stop offset="100%" stop-color="#121324"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill="url(#g)"/>
    <circle cx="100" cy="100" r="46" fill="rgba(255,255,255,0.06)"/>
    <path fill="#ff2a5f" d="M88 64v50a18 18 0 1 0 12 17V84h24V64z"/>
  </svg>
`);

// Modos de interfaz disponibles
export const THEMES = {
  dark:      { label: "Modo oscuro",             color: "#09090e" },
  light:     { label: "Modo claro",              color: "#f4f4f8" },
  halloween: { label: "Modo Halloween 🎃",       color: "#0b0710" },
  criolla:   { label: "Modo Canción Criolla 🎸", color: "#fbf3e6" },
};

export const FADE_SECONDS = 5;

export const formatTime = (s) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
};

export const sanitize = (s) =>
  String(s || "").replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").replace(/\s+/g, " ").trim().slice(0, 100) || "pista";

export const extOf = (src) => {
  const m = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(src || "");
  return m ? m[1].toLowerCase() : "mp3";
};

export const fileNameFor = (song) => `${sanitize(`${song.artist} - ${song.title}`)}.${extOf(song.src)}`;

export function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function saveFile(href, name) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// onError para <img>: cambia a la carátula de respaldo una sola vez
export function coverFallback(e) {
  const img = e.currentTarget;
  if (img.dataset.fallback) return;
  img.dataset.fallback = "1";
  img.src = FALLBACK_COVER;
}

