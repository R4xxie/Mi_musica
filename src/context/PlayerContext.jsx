import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Store from "../lib/storage.js";
import { FADE_SECONDS, FALLBACK_COVER, shuffleArray } from "../lib/utils.js";
import { useToast } from "./ToastContext.jsx";
import { useLibrary } from "./LibraryContext.jsx";

const PlayerContext = createContext(null);

/*
 * Motor de reproducción.
 * El estado "mutable" (cola, índice, ganancia del fade…) vive en un ref para
 * que los manejadores de eventos del <audio> nunca lean valores obsoletos;
 * `rerender()` sincroniza la interfaz cuando algo visible cambia.
 */
export function PlayerProvider({ children }) {
  const { showToast } = useToast();
  const { songs } = useLibrary();
  const songsRef = useRef(songs);
  songsRef.current = songs;

  const audioRef = useRef(null);
  if (!audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.preload = "metadata";
  }
  const audio = audioRef.current;

  const engRef = useRef(null);
  if (!engRef.current) {
    const savedVol = Number(Store.prefs.get("vol", 0.8));
    const userVolume = Number.isFinite(savedVol) ? Math.min(1, Math.max(0, savedVol)) : 0.8;
    engRef.current = {
      queue: [],           // Canciones en cola de reproducción
      originalQueue: [],   // Cola original antes de mezclar (shuffle)
      index: -1,
      shuffle: !!Store.prefs.get("shuffle", false),
      repeat: Store.prefs.get("repeat", "off"), // "off" | "all" | "one"
      fade: !!Store.prefs.get("fade", false),
      userVolume,          // Volumen elegido por el usuario (slider)
      lastVolume: userVolume > 0 ? userVolume : 0.8,
      fadeGain: 1,         // Multiplicador 0..1 aplicado por el fade
      fadeRaf: 0,
      errors: 0,
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

    // Volumen real = volumen del usuario × ganancia del fade
    const applyVolume = () => {
      audio.volume = Math.min(1, Math.max(0, eng.userVolume * eng.fadeGain));
    };

    /* ---------- Modo transición: fade in / fade out de 5 s ----------
     * La ganancia se calcula a partir de la posición de la canción:
     *   - primeros 5 s  -> sube de 0 a 1 (fade in)
     *   - últimos 5 s   -> baja de 1 a 0 (fade out)
     * Así funciona igual al saltar, adelantar o repetir.
     */
    const computeFadeGain = () => {
      if (!eng.fade) return 1;
      const t = audio.currentTime || 0;
      const d = audio.duration;
      if (!Number.isFinite(d) || d <= 0) return Math.min(1, t / FADE_SECONDS);
      const len = Math.min(FADE_SECONDS, d / 2); // canciones muy cortas
      return Math.max(0, Math.min(1, t / len, (d - t) / len));
    };

    const updateFade = () => {
      eng.fadeGain = computeFadeGain();
      applyVolume();
    };

    // requestAnimationFrame para suavidad; timeupdate sirve de respaldo
    // cuando la pestaña está en segundo plano (rAF se pausa).
    const fadeLoop = () => {
      updateFade();
      eng.fadeRaf = eng.fade && !audio.paused ? requestAnimationFrame(fadeLoop) : 0;
    };
    const startFadeLoop = () => {
      if (eng.fade && !eng.fadeRaf) eng.fadeRaf = requestAnimationFrame(fadeLoop);
    };

    const play = () => {
      setIsPlaying(true);
      const p = audio.play();
      if (p !== undefined) {
        p.catch((err) => {
          console.warn("Reproducción en espera o bloqueada:", err);
          setIsPlaying(false);
        });
      }
    };

    const playCurrent = () => {
      const song = currentSong();
      if (!song) return;
      setError(false);
      audio.src = song.src;
      if (eng.fade) {
        // Arranca en silencio para que el fade in empiece desde 0
        eng.fadeGain = 0;
        applyVolume();
      }
      play();
      Store.recent.push(song.id);

      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: song.title,
          artist: song.artist,
          artwork: [{ src: song.cover || FALLBACK_COVER, sizes: "512x512", type: "image/jpeg" }],
        });
      }
      rerender();
    };

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
      if (audio.paused) play();
      else {
        audio.pause();
        setIsPlaying(false);
      }
    };

    const playNext = () => {
      if (!eng.queue.length) return;
      if (eng.repeat === "one") {
        audio.currentTime = 0;
        audio.play().catch(console.warn);
        return;
      }
      const nextIdx = eng.index + 1;
      if (nextIdx < eng.queue.length) {
        eng.index = nextIdx;
        playCurrent();
      } else if (eng.repeat === "all") {
        eng.index = 0;
        playCurrent();
      } else {
        audio.pause();
        audio.currentTime = 0;
        setIsPlaying(false);
      }
    };

    const playPrev = () => {
      if (!eng.queue.length) return;
      if (audio.currentTime > 3) {
        audio.currentTime = 0;
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
      rerender();
    };

    const cycleRepeatMode = () => {
      eng.repeat = eng.repeat === "off" ? "all" : eng.repeat === "all" ? "one" : "off";
      Store.prefs.set("repeat", eng.repeat);
      showToast(eng.repeat === "one" ? "Repetir una canción" : eng.repeat === "all" ? "Repetir lista" : "Repetición apagada");
      rerender();
    };

    const toggleFade = () => {
      eng.fade = !eng.fade;
      Store.prefs.set("fade", eng.fade);
      if (eng.fade) {
        updateFade();
        startFadeLoop();
      } else {
        eng.fadeGain = 1;
        applyVolume();
      }
      showToast(eng.fade ? "Modo transición activado · fade de 5 s" : "Modo transición desactivado");
      rerender();
    };

    const setVolume = (v) => {
      audio.muted = false;
      eng.userVolume = v;
      if (v > 0) eng.lastVolume = v;
      applyVolume();
      Store.prefs.set("vol", v);
      setMuted(false);
      rerender();
    };

    const toggleMute = () => {
      if (audio.muted || eng.userVolume === 0) {
        audio.muted = false;
        if (eng.userVolume === 0) eng.userVolume = eng.lastVolume || 0.8;
        applyVolume();
      } else {
        audio.muted = true;
      }
      setMuted(audio.muted);
      rerender();
    };

    const seekBy = (delta) => {
      if (Number.isFinite(audio.duration)) {
        audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + delta));
      }
    };

    return {
      currentSong, applyVolume, updateFade, startFadeLoop,
      playQueue, togglePlay, playNext, playPrev,
      toggleShuffle, cycleRepeatMode, toggleFade, setVolume, toggleMute, seekBy,
    };
  }, [audio, eng, showToast]);

  /* ---------- Eventos del <audio> ---------- */
  useEffect(() => {
    actions.applyVolume();

    const onPlay = () => { setIsPlaying(true); actions.startFadeLoop(); };
    const onPause = () => setIsPlaying(false);
    const onPlaying = () => { eng.errors = 0; };
    const onTime = () => { if (eng.fade) actions.updateFade(); };
    const onEnded = () => actions.playNext();
    const onError = () => {
      if (!audio.src) return;
      console.error("Error al cargar pista:", audio.src);
      eng.errors++;
      setIsPlaying(false);
      if (eng.errors < eng.queue.length) {
        actions.playNext();
      } else {
        eng.errors = 0;
        setError(true);
      }
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", actions.togglePlay);
      navigator.mediaSession.setActionHandler("pause", actions.togglePlay);
      navigator.mediaSession.setActionHandler("previoustrack", actions.playPrev);
      navigator.mediaSession.setActionHandler("nexttrack", actions.playNext);
    }

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [audio, eng, actions]);

  const currentSong = actions.currentSong();

  useEffect(() => {
    if (currentSong) document.title = `${currentSong.title} • ${currentSong.artist}`;
  }, [currentSong]);

  const value = {
    ...actions,
    audio,
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
