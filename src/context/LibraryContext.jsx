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
    loadLibrary({
      // Datos nuevos de Supabase tras pintar desde la caché local
      onUpdate: ({ songs, playlists }) => {
        if (!cancelled) setState({ status: "ready", songs, playlists });
      },
    })
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
    const resolve = (ids) => ids.map((id) => songMap.get(id)).filter(Boolean);
    // Portada y número de canciones precalculados (evita resolver en cada render)
    const withMeta = (pl) => {
      const list = resolve(pl.songIds);
      return { ...pl, count: list.length, firstCover: list.find((s) => s.cover)?.cover || "" };
    };
    const genrePlaylists = buildGenrePlaylists(state.songs).map(withMeta);
    const playlists = state.playlists.map(withMeta);
    return { ...state, playlists, songMap, genrePlaylists, resolve };
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
  // Set → comprobación O(1) por fila en listas largas
  return useMemo(() => {
    const ids = Store.favorites.all();
    const set = new Set(ids);
    return { ids, has: (id) => set.has(String(id)), count: ids.length, toggle: Store.favorites.toggle };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
}

export function useRecent() {
  const version = useStoreEvent("store:recent");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => Store.recent.all(), [version]);
}

