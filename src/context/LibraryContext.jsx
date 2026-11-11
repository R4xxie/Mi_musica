import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loadLibrary, slugify } from "../lib/data.js";
import Store from "../lib/storage.js";

const LibraryContext = createContext(null);

/* ---------- Auto-descubrimiento Dinámico de Géneros ---------- */
function buildGenrePlaylists(songs) {
  const map = new Map();
  songs.forEach((song) => {
    const g = (song.genre || "Otros").trim();
    if (!map.has(g)) map.set(g, []);
    map.get(g).push(song.id);
  });

  return Array.from(map.entries()).map(([name, songIds]) => ({
    id: `genero-${slugify(name)}`,
    rawGenre: name,
    name,
    description: `Todas las canciones de ${name} (${songIds.length})`,
    songIds,
    isGenre: true,
  }));
}

export function LibraryProvider({ children }) {
  const [state, setState] = useState({ status: "loading", songs: [], playlists: [] });

  useEffect(() => {
    let cancelled = false;
    Store.userId();
    loadLibrary()
      .then(({ songs, playlists }) => {
        if (!cancelled) setState({ status: "ready", songs, playlists });
      })
      .catch((err) => {
        console.error("Error al iniciar Mi Música:", err);
        if (!cancelled) setState({ status: "error", songs: [], playlists: [] });
      });
    return () => { cancelled = true; };
  }, []);

  const value = useMemo(() => {
    const songMap = new Map(state.songs.map((s) => [s.id, s]));
    const genrePlaylists = buildGenrePlaylists(state.songs);
    const resolve = (ids) => ids.map((id) => songMap.get(id)).filter(Boolean);
    return { ...state, songMap, genrePlaylists, resolve };
  }, [state]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export const useLibrary = () => useContext(LibraryContext);

/* ---------- Suscripción a cambios de cookies (favoritos / recientes) ---------- */
function useStoreEvent(eventName) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const onChange = () => setVersion((v) => v + 1);
    window.addEventListener(eventName, onChange);
    return () => window.removeEventListener(eventName, onChange);
  }, [eventName]);
  return version;
}

export function useFavorites() {
  const version = useStoreEvent("store:favorites");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ids = useMemo(() => Store.favorites.all(), [version]);
  return { ids, has: (id) => ids.includes(String(id)), count: ids.length, toggle: Store.favorites.toggle };
}

export function useRecent() {
  const version = useStoreEvent("store:recent");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => Store.recent.all(), [version]);
}

