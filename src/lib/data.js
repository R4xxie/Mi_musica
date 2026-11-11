/*
 * Capa de datos con soporte para Supabase (PostgREST + Storage CDN) y Respaldo Local.
 *
 * Mantiene desacoplada la interfaz del origen de datos.
 *   1. Las canciones se leen desde la tabla `songs` de Supabase en la nube.
 *   2. Los archivos de audio se reproducen en streaming desde tu Storage público.
 *   3. Si no hay internet o las claves están vacías, se usa public/data/db.json como respaldo.
 *
 * La configuración puede sobreescribirse con variables de entorno de Vite
 * (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_BUCKET), por
 * ejemplo desde GitHub Actions o un archivo .env.local.
 */

const LOCAL_DB_URL = `${import.meta.env.BASE_URL}data/db.json`;

// --- CONFIGURACIÓN DE TU PROYECTO SUPABASE ---
const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL || "https://vjeknodqepfjlzkjanat.supabase.co", // URL de tu proyecto
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_wuJfLTQk2i-Ao29KC4MnnA_y_EKVxmK", // Clave pública 'anon'
  bucket: import.meta.env.VITE_SUPABASE_BUCKET || "music",                              // Bucket de almacenamiento público
};

export const isSupabaseEnabled = () =>
  Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);

/* ---------- Preconexión al servidor de Supabase ----------
 * Abre DNS + TLS por adelantado para que el primer play no espere el
 * handshake. Dos variantes: con CORS (fetch de la API) y sin CORS (<audio>).
 */
(function preconnect() {
  if (!isSupabaseEnabled() || typeof document === "undefined") return;
  const origin = new URL(SUPABASE_CONFIG.url).origin;
  [true, false].forEach((cors) => {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = origin;
    if (cors) link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  });
})();

export const slugify = (s) =>
  String(s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "playlist";

/* ---------- Resolver URL de Audio (Local o Supabase Storage) ---------- */
export function resolveAudioUrl(src) {
  if (!src) return "";
  // Si ya es una URL completa (http/https), se respeta
  if (/^https?:\/\//i.test(src)) return src;

  // Si Supabase está habilitado, construir la URL de Supabase Storage
  if (isSupabaseEnabled()) {
    const baseUrl = SUPABASE_CONFIG.url.replace(/\/+$/, "");
    const cleanPath = src.replace(/^\/+/, "");
    return `${baseUrl}/storage/v1/object/public/${SUPABASE_CONFIG.bucket}/${cleanPath}`;
  }

  // Si es local, asegurarse de que apunte a audio/ si no tiene prefijo
  if (!src.startsWith("audio/") && !src.includes("/")) {
    return `audio/${src}`;
  }
  return src;
}

/* ---------- Proveedor: Supabase (PostgREST sin SDKs) ---------- */
async function fetchFromSupabase() {
  const headers = {
    "apikey": SUPABASE_CONFIG.anonKey,
    "Authorization": `Bearer ${SUPABASE_CONFIG.anonKey}`,
    "Accept": "application/json",
  };

  const baseUrl = SUPABASE_CONFIG.url.replace(/\/+$/, "");

  const [songsRes, plRes] = await Promise.all([
    fetch(`${baseUrl}/rest/v1/songs?select=*&order=id.asc`, { headers }),
    fetch(`${baseUrl}/rest/v1/playlists?select=*&order=created_at.asc`, { headers }),
  ]);

  if (!songsRes.ok) throw new Error(`Supabase songs: HTTP ${songsRes.status}`);
  if (!plRes.ok) throw new Error(`Supabase playlists: HTTP ${plRes.status}`);

  const rawSongs = await songsRes.json();
  const rawPlaylists = await plRes.json();

  return {
    songs: rawSongs,
    playlists: rawPlaylists.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      cover: p.cover,
      songs: Array.isArray(p.songs) ? p.songs : (typeof p.songs === "string" ? JSON.parse(p.songs) : []),
    })),
  };
}

/* ---------- Proveedor: Local (public/data/db.json) ---------- */
async function fetchFromLocal() {
  const res = await fetch(LOCAL_DB_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status} al leer ${LOCAL_DB_URL}`);
  return res.json();
}

/* ---------- Normalización común ---------- */
function normalizeSong(raw) {
  const rawSrc = String(raw.src || "");
  return {
    id: String(raw.id),
    title: String(raw.title || "Sin título"),
    artist: String(raw.artist || "Desconocido"),
    album: raw.album ? String(raw.album) : "",
    genre: String(raw.genre || "Trap"),
    cover: raw.cover ? String(raw.cover) : "",
    rawSrc: rawSrc,
    src: resolveAudioUrl(rawSrc),
  };
}

function normalize(data) {
  const rawSongs = Array.isArray(data) ? data : data.songs || [];
  const rawPlaylists = Array.isArray(data) ? [] : data.playlists || [];

  const seen = new Set();
  const songs = [];
  rawSongs.forEach((raw) => {
    const song = normalizeSong(raw);
    if (seen.has(song.id)) return;
    if (!song.rawSrc) return;
    seen.add(song.id);
    songs.push(song);
  });

  const usedIds = new Set();
  const playlists = rawPlaylists.map((pl) => {
    const name = String(pl.name || "Sin nombre");
    let id = slugify(pl.id || name);
    for (let n = 2; usedIds.has(id); n++) id = `${slugify(pl.id || name)}-${n}`;
    usedIds.add(id);

    const songIds = (pl.songs || []).map(String).filter((sid) => seen.has(sid));

    return {
      id,
      name,
      description: pl.description ? String(pl.description) : "",
      cover: pl.cover ? String(pl.cover) : "",
      songIds,
    };
  });

  return { songs, playlists };
}

export async function loadLibrary() {
  let rawData;
  if (isSupabaseEnabled()) {
    try {
      rawData = await fetchFromSupabase();
      console.info("Biblioteca conectada con Supabase ⚡");
    } catch (err) {
      console.warn("No se pudo conectar con Supabase, usando respaldo local:", err);
      rawData = await fetchFromLocal();
    }
  } else {
    rawData = await fetchFromLocal();
  }
  return normalize(rawData);
}

export function setSupabaseConfig(url, anonKey, bucket = "music") {
  SUPABASE_CONFIG.url = url;
  SUPABASE_CONFIG.anonKey = anonKey;
  SUPABASE_CONFIG.bucket = bucket;
}
