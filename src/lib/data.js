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
const FETCH_TIMEOUT_MS = 8000;

// --- CONFIGURACIÓN DE TU PROYECTO SUPABASE ---
const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL || "https://gryvyterwkkdejmbtucc.supabase.co", // URL de tu proyecto
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_yTSQLOFwdfrNM6Z6-R8Mnw_LO0UF5sX", // Clave pública (publishable)
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

  // Si Supabase no responde a tiempo se aborta y se usa el respaldo local
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  const opts = { headers, signal: ctrl.signal };

  try {
    const [songsRes, plRes] = await Promise.all([
      fetch(`${baseUrl}/rest/v1/songs?select=*&order=id.asc`, opts),
      fetch(`${baseUrl}/rest/v1/playlists?select=*&order=created_at.asc`, opts),
    ]);

    if (!songsRes.ok) throw new Error(`Supabase songs: HTTP ${songsRes.status}`);
    if (!plRes.ok) throw new Error(`Supabase playlists: HTTP ${plRes.status}`);

    const [rawSongs, rawPlaylists] = await Promise.all([songsRes.json(), plRes.json()]);
    return mapSupabase(rawSongs, rawPlaylists);
  } finally {
    clearTimeout(timeout);
  }
}

function parseSongIds(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapSupabase(rawSongs, rawPlaylists) {
  return {
    songs: rawSongs,
    playlists: rawPlaylists.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      cover: p.cover,
      songs: parseSongIds(p.songs),
    })),
  };
}

/* ---------- Caché local (stale-while-revalidate) ----------
 * La última biblioteca descargada se guarda en localStorage. En la siguiente
 * visita la interfaz se pinta al instante con la caché y Supabase se consulta
 * en segundo plano; si hay cambios, se actualiza la vista.
 * La clave incluye la URL y la API key, así un cambio de proyecto/clave
 * invalida automáticamente la caché anterior.
 */
const cacheKey = () => `mm_lib_v1:${SUPABASE_CONFIG.url}:${SUPABASE_CONFIG.anonKey.slice(-8)}`;

function readCache() {
  try {
    const raw = localStorage.getItem(cacheKey());
    return raw ? { text: raw, data: JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

function writeCache(text) {
  try {
    const key = cacheKey();
    // Limpia cachés de versiones / claves anteriores
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("mm_lib_") && k !== key) localStorage.removeItem(k);
    }
    localStorage.setItem(key, text);
  } catch { /* cuota llena o modo privado: se ignora */ }
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

/**
 * Carga la biblioteca.
 * @param {{ onUpdate?: (lib: {songs: Array, playlists: Array}) => void }} [options]
 *   onUpdate se llama si, tras pintar desde la caché, Supabase devuelve datos nuevos.
 */
export async function loadLibrary({ onUpdate } = {}) {
  if (!isSupabaseEnabled()) return normalize(await fetchFromLocal());

  const cached = readCache();

  const refresh = async () => {
    const fresh = await fetchFromSupabase();
    const text = JSON.stringify(fresh);
    const changed = !cached || cached.text !== text;
    if (changed) writeCache(text);
    console.info("Biblioteca conectada con Supabase ⚡");
    return { data: fresh, changed };
  };

  // Hay caché: se devuelve al instante y se revalida en segundo plano
  if (cached) {
    refresh()
      .then(({ data, changed }) => { if (changed && onUpdate) onUpdate(normalize(data)); })
      .catch((err) => console.warn("No se pudo revalidar con Supabase (usando caché):", err));
    return normalize(cached.data);
  }

  try {
    const { data } = await refresh();
    return normalize(data);
  } catch (err) {
    console.warn("No se pudo conectar con Supabase, usando respaldo local:", err);
    return normalize(await fetchFromLocal());
  }
}

export function setSupabaseConfig(url, anonKey, bucket = "music") {
  SUPABASE_CONFIG.url = url;
  SUPABASE_CONFIG.anonKey = anonKey;
  SUPABASE_CONFIG.bucket = bucket;
}
