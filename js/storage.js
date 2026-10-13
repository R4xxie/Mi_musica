/*
 * Persistencia por visitante usando cookies propias.
 *
 * Cada navegador guarda SUS favoritos, su historial reciente y sus
 * preferencias (volumen, aleatorio, repetir). No se envía nada a terceros.
 *
 * Las cookies se limitan a la carpeta del sitio (Path), así en GitHub Pages
 * no se mezclan con otros repos de usuario.github.io.
 *
 * API global: window.Store
 */
(() => {
  "use strict";

  const PREFIX = "mm_";
  const ONE_YEAR = 60 * 60 * 24 * 365;
  const COOKIE_PATH = location.pathname.replace(/[^/]*$/, "") || "/";
  const MAX_COOKIE_BYTES = 3800;       // margen bajo el límite de ~4 KB
  const MAX_RECENT = 30;

  /* ---------- Cookies de bajo nivel ---------- */
  const Cookies = {
    get(name) {
      const key = PREFIX + name + "=";
      const hit = document.cookie.split("; ").find((c) => c.startsWith(key));
      if (!hit) return null;
      try { return decodeURIComponent(hit.slice(key.length)); } catch { return null; }
    },
    set(name, value, maxAge = ONE_YEAR) {
      let cookie = `${PREFIX}${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=${COOKIE_PATH}; SameSite=Lax`;
      if (location.protocol === "https:") cookie += "; Secure";
      document.cookie = cookie;
    },
    remove(name) {
      document.cookie = `${PREFIX}${name}=; Max-Age=0; Path=${COOKIE_PATH}; SameSite=Lax`;
    },
  };

  // Lista de ids separada por "." (no se codifica, ocupa poco)
  const readList = (name) => (Cookies.get(name) || "").split(".").filter(Boolean);
  const writeList = (name, list) => {
    // Recorta los más antiguos si la cookie se pasara de tamaño
    let items = list.slice();
    while (items.length && items.join(".").length > MAX_COOKIE_BYTES) items.shift();
    if (items.length) Cookies.set(name, items.join("."));
    else Cookies.remove(name);
    return items;
  };

  const emit = (type, detail) => window.dispatchEvent(new CustomEvent(type, { detail }));

  /* ---------- Favoritos ---------- */
  // Orden: del más antiguo al más reciente (el último marcado va al final)
  let favs = readList("favs");

  const favorites = {
    all: () => favs.slice(),
    has: (id) => favs.includes(String(id)),
    count: () => favs.length,
    toggle(id) {
      id = String(id);
      const added = !favs.includes(id);
      const next = added ? [...favs, id] : favs.filter((f) => f !== id);
      const saved = writeList("favs", next);
      const truncated = added && saved.length < next.length;
      favs = saved;
      emit("store:favorites", { id, added, truncated });
      return added;
    },
    // Otra pestaña pudo cambiar la cookie: relee y avisa si cambió
    refresh() {
      const fresh = readList("favs");
      if (fresh.join(".") !== favs.join(".")) {
        favs = fresh;
        emit("store:favorites", { id: null, added: false });
      }
    },
  };

  /* ---------- Escuchado recientemente ---------- */
  const recent = {
    // Más reciente primero
    all: () => readList("recent").reverse(),
    push(id) {
      id = String(id);
      const list = readList("recent").filter((r) => r !== id);
      list.push(id);
      writeList("recent", list.slice(-MAX_RECENT));
      emit("store:recent", { id });
    },
    clear() {
      Cookies.remove("recent");
      emit("store:recent", { id: null });
    },
  };

  /* ---------- Preferencias (JSON pequeño) ---------- */
  let prefsCache = (() => {
    try { return JSON.parse(Cookies.get("prefs") || "{}") || {}; } catch { return {}; }
  })();

  const prefs = {
    get: (key, fallback) => (key in prefsCache ? prefsCache[key] : fallback),
    set(key, value) {
      prefsCache = { ...prefsCache, [key]: value };
      Cookies.set("prefs", JSON.stringify(prefsCache));
    },
  };

  /* ---------- Identificador anónimo del visitante ----------
   * Sirve para, más adelante, sincronizar favoritos con Supabase sin
   * pedir registro. Es aleatorio y no identifica a la persona.
   */
  function userId() {
    let id = Cookies.get("uid");
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) ||
        Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }
    Cookies.set("uid", id);         // renueva la caducidad en cada visita
    return id;
  }

  /* ---------- Aviso de cookies ---------- */
  const consent = {
    seen: () => Cookies.get("consent") === "1",
    accept: () => Cookies.set("consent", "1"),
  };

  /* ---------- Borrar todo ---------- */
  function clearAll() {
    ["favs", "recent", "prefs", "uid", "consent"].forEach(Cookies.remove);
    favs = [];
    prefsCache = {};
    emit("store:favorites", { id: null, added: false });
    emit("store:recent", { id: null });
  }

  window.Store = { favorites, recent, prefs, userId, consent, clearAll, Cookies };
})();
