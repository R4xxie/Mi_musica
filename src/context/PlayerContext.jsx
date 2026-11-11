import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Store from "../lib/storage.js";
import { FADE_MIN_GAIN, FADE_SECONDS, FALLBACK_COVER, shuffleArray } from "../lib/utils.js";
import { useToast } from "./ToastContext.jsx";
import { useLibrary } from "./LibraryContext.jsx";

const PlayerContext = createContext(null);

/*
 * Motor de reproducción con un pool de 3 elementos <audio> ("decks"):
 *   - current:  el que suena y controla la interfaz
 *   - outgoing: el que se está desvaneciendo durante un crossfade
 *   - el resto: precargan la siguiente canción de la cola y la canción
 *               sobre la que pasa el mouse, para que el play sea inmediato.
 *
 * Modo transición: cada deck calcula su volumen según su posición:
 *   - primeros 5 s  -> sube de 30 % a 100 %
 *   - últimos 5 s   -> baja de 100 % a 30 %
 * Cuando a la canción le quedan 5 s, la siguiente arranca en otro deck y
 * ambas se superponen (crossfade).
 *
 * El estado mutable vive en un ref para que los manejadores de eventos del
 * <audio> nunca lean valores obsoletos; `rerender()` sincroniza la interfaz.
 */
const POOL_SIZE = 3;

function createDeck() {
  const el = new Audio();
  el.preload = "auto";
  return el;
}

export function PlayerProvider({ children }) {
  const { showToast } = useToast();
  const { songs } = useLibrary();
  const songsRef = useRef(songs);
  songsRef.current = songs;

  const engRef = useRef(null);
  if (!engRef.current) {
    const savedVol = Number(Store.prefs.get("vol", 0.8));
    const userVolume = Number.isFinite(savedVol) ? Math.min(1, Math.max(0, savedVol)) : 0.8;
    const pool = Array.from({ length: POOL_SIZE }, createDeck);
    engRef.current = {
      pool,
      current: pool[0],    // Deck que suena
      outgoing: null,      // Deck saliendo durante el crossfade
      nextDeck: null,      // Deck con la siguiente canción precargada
      hoverDeck: null,     // Deck con la canción precargada al pasar el mouse
      queue: [],           // Canciones en cola de reproducción
      originalQueue: [],   // Cola original antes de mezclar (shuffle)
      index: -1,
      shuffle: !!Store.prefs.get("shuffle", false),
      repeat: Store.prefs.get("repeat", "off"), // "off" | "all" | "one"
      fade: !!Store.prefs.get("fade", false),
      userVolume,          // Volumen elegido por el usuario (slider)
      lastVolume: userVolume > 0 ? userVolume : 0.8,
      muted: false,
      raf: 0,
      errors: 0,
      preloadTimer: 0,
    };
  }
  const eng = engRef.current;

  const [, rerender] = useReducer((x) => x + 1, 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState(false);

  const actions = useMemo(() => {
    const currentSong = () =>
      eng.index >= 0 && eng.index < eng.queue.length ? eng.queue[eng.index] : null;

    /* ---------- Decks ---------- */
    const songIdOf = (el) => el.dataset.songId || "";
    const isBusy = (el) => el === eng.current || el === eng.outgoing;
    const idleDecks = () => eng.pool.filter((el) => !isBusy(el));
    const holds = (el, song) => songIdOf(el) === song.id && !el.error;

    const loadInto = (el, song) => {
      el.pause();
      el.dataset.songId = song.id;
      el.src = song.src;           // dispara la descarga (preload="auto")
    };

    const stopDeck = (el) => {
      if (!el) return;
      el.pause();
      try { el.currentTime = 0; } catch { /* sin metadatos aún */ }
    };

    /* ---------- Volumen y fade ---------- */
    const gainOf = (el) => {
      if (!eng.fade) return 1;
      const t = el.currentTime || 0;
      const d = el.duration;
      const len = Number.isFinite(d) && d > 0 ? Math.min(FADE_SECONDS, d / 2) : FADE_SECONDS;
      const progress = Number.isFinite(d) && d > 0 ? Math.min(t / len, (d - t) / len) : t / len;
      return FADE_MIN_GAIN + (1 - FADE_MIN_GAIN) * Math.max(0, Math.min(1, progress));
    };

    // Volumen real = volumen del usuario × ganancia del fade (por deck)
    const applyVolume = () => {
      eng.pool.forEach((el) => {
        el.volume = Math.min(1, Math.max(0, eng.userVolume * gainOf(el)));
        el.muted = eng.muted;
      });
    };

    /* ---------- Cola ---------- */
    const nextIndex = () => {
      if (!eng.queue.length) return -1;
      if (eng.repeat === "one") return eng.index;
      const i = eng.index + 1;
      if (i < eng.queue.length) return i;
      return eng.repeat === "all" ? 0 : -1;
    };

    /* ---------- Precarga ---------- */
    const preloadNext = () => {
      clearTimeout(eng.preloadTimer);
      const i = nextIndex();
      if (i < 0 || eng.repeat === "one") return;
      const song = eng.queue[i];
      const already = idleDecks().find((el) => holds(el, song));
      if (already) {
        eng.nextDeck = already;
        return;
      }
      const idle = idleDecks();
      const el = idle.find((d) => d !== eng.hoverDeck) || idle[0];
      if (!el) return;
      loadInto(el, song);
      eng.nextDeck = el;
      if (eng.hoverDeck === el) eng.hoverDeck = null;
    };

    // Espera a que la canción actual tenga buffer suficiente antes de
    // descargar la siguiente, para no competir por el ancho de banda.
    const schedulePreloadNext = (el) => {
      clearTimeout(eng.preloadTimer);
      const run = () => { if (eng.current === el) preloadNext(); };
      if (el.readyState >= 4) {
        eng.preloadTimer = setTimeout(run, 500);
      } else {
        el.addEventListener("canplaythrough", run, { once: true });
        eng.preloadTimer = setTimeout(run, 8000);
      }
    };

    // Precarga al pasar el mouse / tocar una canción
    const prefetch = (song) => {
      if (!song || eng.pool.some((el) => holds(el, song))) return;
      const el = idleDecks().find((d) => d !== eng.nextDeck);
      if (!el) return;
      loadInto(el, song);
      eng.hoverDeck = el;
    };

    const deckFor = (song) => {
      const ready = idleDecks().find((el) => holds(el, song));
      if (ready) {
        try { ready.currentTime = 0; } catch { /* noop */ }
        return ready;
      }
      const idle = idleDecks();
      const el = idle.find((d) => d !== eng.nextDeck && d !== eng.hoverDeck) ||
        idle.find((d) => d !== eng.nextDeck) || idle[0];
      loadInto(el, song);
      return el;
    };

    /* ---------- Reproducción ---------- */
    const play = (el) => {
      setIsPlaying(true);
      const p = el.play();
      if (p === undefined) return;
      p.catch((err) => {
        if (err.name === "AbortError") return;
        // iOS/Safari bloquea play() en un <audio> que nunca tuvo un gesto del
        // usuario: en ese caso se reutiliza un deck ya desbloqueado.
        const song = currentSong();
        if (err.name === "NotAllowedError" && el === eng.current && song) {
          const fallback = [eng.outgoing, ...eng.pool].find((d) => d && d !== el && d._unlocked);
          if (fallback) {
            if (eng.outgoing === fallback) eng.outgoing = null;
            stopDeck(el);
            loadInto(fallback, song);
            eng.current = fallback;
            applyVolume();
            rerender();
            fallback.play().catch(() => setIsPlaying(false));
            return;
          }
        }
        console.warn("Reproducción en espera o bloqueada:", err);
        if (el === eng.current) setIsPlaying(false);
      });
    };

    const playCurrent = ({ crossfade = false } = {}) => {
      const song = currentSong();
      if (!song) return;
      setError(false);

      const prev = eng.current;
      if (eng.outgoing) {
        stopDeck(eng.outgoing);
        eng.outgoing = null;
      }

      const el = deckFor(song);
      if (crossfade && prev !== el && !prev.paused) eng.outgoing = prev;
      else if (prev !== el) stopDeck(prev);

      eng.current = el;
      if (eng.nextDeck === el) eng.nextDeck = null;
      if (eng.hoverDeck === el) eng.hoverDeck = null;

      applyVolume();
      play(el);
      startFadeLoop();
      Store.recent.push(song.id);
      schedulePreloadNext(el);

      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: song.title,
          artist: song.artist,
          artwork: [{ src: song.cover || FALLBACK_COVER, sizes: "512x512", type: "image/jpeg" }],
        });
      }
      rerender();
    };

    /* ---------- Crossfade ---------- */
    const maybeCrossfade = () => {
      if (!eng.fade || eng.outgoing || eng.repeat === "one") return;
      const el = eng.current;
      if (el.paused || el.seeking) return;
      const d = el.duration;
      if (!Number.isFinite(d) || d <= 0) return;
      const len = Math.min(FADE_SECONDS, d / 2);
      if (d - el.currentTime > len) return;
      const i = nextIndex();
      if (i < 0) return;
      eng.index = i;
      playCurrent({ crossfade: true });
    };

    const tick = () => {
      applyVolume();
      maybeCrossfade();
    };

    // requestAnimationFrame para suavidad; timeupdate sirve de respaldo
    // cuando la pestaña está en segundo plano (rAF se pausa).
    const fadeLoop = () => {
      tick();
      const anyPlaying = eng.pool.some((el) => !el.paused);
      eng.raf = eng.fade && anyPlaying ? requestAnimationFrame(fadeLoop) : 0;
    };
    const startFadeLoop = () => {
      if (eng.fade && !eng.raf) eng.raf = requestAnimationFrame(fadeLoop);
    };

    /* ---------- Acciones públicas ---------- */
    const playQueue = (list, startIndex = 0) => {
      if (!list || !list.length) return;
      eng.originalQueue = list.slice();
      if (eng.shuffle) {
        const selected = list[startIndex];
        const rest = shuffleArray(list.filter((_, i) => i !== startIndex));
        eng.queue = [selected, ...rest];
        eng.index = 0;
      } else {
        eng.queue = eng.originalQueue.slice();
        eng.index = startIndex;
      }
      playCurrent();
    };

    const togglePlay = () => {
      if (!currentSong()) {
        if (songsRef.current.length) playQueue(songsRef.current, 0);
        return;
      }
      if (eng.current.paused) {
        play(eng.current);
        if (eng.outgoing) eng.outgoing.play().catch(() => {});
        startFadeLoop();
      } else {
        eng.current.pause();
        eng.outgoing?.pause();
        setIsPlaying(false);
      }
    };

    const playNext = () => {
      if (!eng.queue.length) return;
      if (eng.repeat === "one") {
        eng.current.currentTime = 0;
        play(eng.current);
        return;
      }
      const i = nextIndex();
      if (i >= 0) {
        eng.index = i;
        playCurrent();
      } else {
        stopDeck(eng.current);
        setIsPlaying(false);
      }
    };

    const playPrev = () => {
      if (!eng.queue.length) return;
      if (eng.current.currentTime > 3) {
        eng.current.currentTime = 0;
        return;
      }
      eng.index = eng.index <= 0 ? (eng.repeat === "all" ? eng.queue.length - 1 : 0) : eng.index - 1;
      playCurrent();
    };

    const toggleShuffle = () => {
      eng.shuffle = !eng.shuffle;
      Store.prefs.set("shuffle", eng.shuffle);
      const current = currentSong();
      if (eng.shuffle) {
        const rest = shuffleArray(eng.queue.filter((s) => s !== current));
        eng.queue = current ? [current, ...rest] : rest;
        eng.index = current ? 0 : -1;
        showToast("Aleatorio activado");
      } else {
        eng.queue = eng.originalQueue.slice();
        eng.index = current ? eng.queue.indexOf(current) : 0;
        showToast("Aleatorio desactivado");
      }
      if (current) preloadNext();
      rerender();
    };

    const cycleRepeatMode = () => {
      eng.repeat = eng.repeat === "off" ? "all" : eng.repeat === "all" ? "one" : "off";
      Store.prefs.set("repeat", eng.repeat);
      showToast(eng.repeat === "one" ? "Repetir una canción" : eng.repeat === "all" ? "Repetir lista" : "Repetición apagada");
      if (currentSong()) preloadNext();
      rerender();
    };

    const toggleFade = () => {
      eng.fade = !eng.fade;
      Store.prefs.set("fade", eng.fade);
      if (eng.fade) {
        startFadeLoop();
      } else if (eng.outgoing) {
        stopDeck(eng.outgoing);
        eng.outgoing = null;
      }
      applyVolume();
      showToast(eng.fade ? "Modo transición activado · crossfade de 5 s" : "Modo transición desactivado");
      rerender();
    };

    const setVolume = (v) => {
      eng.muted = false;
      eng.userVolume = v;
      if (v > 0) eng.lastVolume = v;
      applyVolume();
      Store.prefs.set("vol", v);
      setMuted(false);
      rerender();
    };

    const toggleMute = () => {
      if (eng.muted || eng.userVolume === 0) {
        eng.muted = false;
        if (eng.userVolume === 0) eng.userVolume = eng.lastVolume || 0.8;
      } else {
        eng.muted = true;
      }
      applyVolume();
      setMuted(eng.muted);
      rerender();
    };

    const seekBy = (delta) => {
      const el = eng.current;
      if (Number.isFinite(el.duration)) {
        el.currentTime = Math.min(el.duration, Math.max(0, el.currentTime + delta));
      }
    };

    return {
      currentSong, applyVolume, tick, startFadeLoop, prefetch,
      playQueue, togglePlay, playNext, playPrev,
      toggleShuffle, cycleRepeatMode, toggleFade, setVolume, toggleMute, seekBy,
    };
  }, [eng, showToast]);

  /* ---------- Eventos de los <audio> ---------- */
  useEffect(() => {
    actions.applyVolume();
    const cleanups = eng.pool.map((el) => {
      const onPlay = () => {
        if (el === eng.current) setIsPlaying(true);
        actions.startFadeLoop();
      };
      const onPause = () => { if (el === eng.current) setIsPlaying(false); };
      const onPlaying = () => {
        el._unlocked = true;
        if (el === eng.current) eng.errors = 0;
      };
      const onTime = () => { if (eng.fade) actions.tick(); };
      const onEnded = () => {
        if (el === eng.outgoing) {
          eng.outgoing = null;
          el.pause();
        } else if (el === eng.current) {
          actions.playNext();
        }
      };
      const onError = () => {
        if (el !== eng.current || !el.getAttribute("src")) return;
        console.error("Error al cargar pista:", el.src);
        eng.errors++;
        setIsPlaying(false);
        if (eng.errors < eng.queue.length) {
          actions.playNext();
        } else {
          eng.errors = 0;
          setError(true);
        }
      };

      const handlers = { play: onPlay, pause: onPause, playing: onPlaying, timeupdate: onTime, ended: onEnded, error: onError };
      Object.entries(handlers).forEach(([ev, fn]) => el.addEventListener(ev, fn));
      return () => Object.entries(handlers).forEach(([ev, fn]) => el.removeEventListener(ev, fn));
    });

    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", actions.togglePlay);
      navigator.mediaSession.setActionHandler("pause", actions.togglePlay);
      navigator.mediaSession.setActionHandler("previoustrack", actions.playPrev);
      navigator.mediaSession.setActionHandler("nexttrack", actions.playNext);
    }

    return () => cleanups.forEach((fn) => fn());
  }, [eng, actions]);

  const currentSong = actions.currentSong();

  useEffect(() => {
    if (currentSong) document.title = `${currentSong.title} • ${currentSong.artist}`;
  }, [currentSong]);

  const value = {
    ...actions,
    audio: eng.current,
    currentSong,
    queue: eng.queue,
    isPlaying,
    isShuffle: eng.shuffle,
    repeatMode: eng.repeat,
    fadeEnabled: eng.fade,
    userVolume: eng.userVolume,
    muted,
    error,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export const usePlayer = () => useContext(PlayerContext);
