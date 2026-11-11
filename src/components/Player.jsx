import { useEffect, useRef, useState } from "react";
import { usePlayer } from "../context/PlayerContext.jsx";
import { FALLBACK_COVER, coverFallback, formatTime } from "../lib/utils.js";
import { FavButton } from "./SongList.jsx";
import {
  IconFade, IconMuted, IconNext, IconPause, IconPlay, IconPrev,
  IconRepeat, IconRepeatOne, IconShuffle, IconVolume,
} from "./Icons.jsx";

/* ---------- Tiempo y buffer leídos directamente del <audio> ---------- */
function useAudioTime(audio) {
  const [t, setT] = useState({ current: 0, duration: NaN, buffered: 0 });
  useEffect(() => {
    const update = () => {
      const d = audio.duration;
      let buffered = 0;
      if (Number.isFinite(d) && audio.buffered.length > 0) {
        buffered = Math.min(100, (audio.buffered.end(audio.buffered.length - 1) / d) * 100);
      }
      setT({ current: audio.currentTime, duration: d, buffered });
    };
    const events = ["timeupdate", "loadedmetadata", "durationchange", "emptied", "seeked"];
    events.forEach((ev) => audio.addEventListener(ev, update));
    return () => events.forEach((ev) => audio.removeEventListener(ev, update));
  }, [audio]);
  return t;
}

/* ---------- Barra de progreso con arrastre ---------- */
function Progress({ audio, enabled, time }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(null); // ratio 0..1 mientras se arrastra

  const ratioFrom = (e) => {
    const rect = ref.current.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  };

  const hasDuration = Number.isFinite(time.duration);
  const pct = drag !== null ? drag * 100 : hasDuration ? (time.current / time.duration) * 100 : 0;
  const p = Math.min(100, Math.max(0, pct));

  return (
    <div
      ref={ref}
      className={`progress${drag !== null ? " dragging" : ""}`}
      id="progress"
      role="slider"
      tabIndex={0}
      aria-label="Progreso de la canción"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p)}
      onPointerDown={(e) => {
        if (!enabled || !hasDuration) return;
        ref.current.setPointerCapture(e.pointerId);
        setDrag(ratioFrom(e));
      }}
      onPointerMove={(e) => {
        if (drag !== null) setDrag(ratioFrom(e));
      }}
      onPointerUp={(e) => {
        if (drag === null) return;
        const ratio = ratioFrom(e);
        setDrag(null);
        if (Number.isFinite(audio.duration)) audio.currentTime = ratio * audio.duration;
      }}
      onPointerCancel={() => setDrag(null)}
    >
      <div className="progress-track">
        <div className="progress-buffer" id="progress-buffer" style={{ width: `${time.buffered}%` }}></div>
        <div className="progress-fill" id="progress-fill" style={{ width: `${p}%` }}></div>
        <div className="progress-thumb" id="progress-thumb" style={{ left: `${p}%` }}></div>
      </div>
    </div>
  );
}

export default function Player() {
  const player = usePlayer();
  const {
    audio, currentSong, isPlaying, isShuffle, repeatMode, fadeEnabled, userVolume, muted, error,
    togglePlay, playNext, playPrev, toggleShuffle, cycleRepeatMode, toggleFade, setVolume, toggleMute,
  } = player;
  const time = useAudioTime(audio);

  const level = muted ? 0 : userVolume;
  const silent = level === 0;
  const repeatLabel = repeatMode === "one" ? "Repetir: una canción" : repeatMode === "all" ? "Repetir: todas" : "Repetir: desactivado";

  return (
    <footer className="player" id="player" aria-label="Reproductor">
      <Progress audio={audio} enabled={!!currentSong} time={time} />

      <div className="player-inner">
        <div className="now-playing">
          {currentSong && (
            <img
              key={currentSong.id}
              id="player-cover"
              className="player-cover"
              alt=""
              src={currentSong.cover || FALLBACK_COVER}
              onError={coverFallback}
            />
          )}
          <div className="now-text">
            <p id="player-title" className="now-title">{currentSong ? currentSong.title : "Selecciona una canción"}</p>
            <p id="player-artist" className="now-artist">
              {error ? "Error al reproducir audio" : currentSong ? currentSong.artist : "\u00a0"}
            </p>
          </div>
          {currentSong && (
            <FavButton
              song={currentSong}
              size={22}
              stop={false}
              toastMessages={["Guardado en tus favoritos 💖", "Eliminado de favoritos 🤍"]}
            />
          )}
        </div>

        <div className="controls">
          <button id="btn-shuffle" className="ctrl ctrl-toggle" type="button" aria-label="Aleatorio" aria-pressed={String(isShuffle)} title="Aleatorio (S)" onClick={toggleShuffle}>
            <IconShuffle size={20} />
          </button>
          <button id="btn-prev" className="ctrl" type="button" aria-label="Anterior" onClick={playPrev}>
            <IconPrev size={26} />
          </button>
          <button id="btn-play" className={`ctrl ctrl-main${isPlaying ? " is-playing" : ""}`} type="button" aria-label={isPlaying ? "Pausar" : "Reproducir"} onClick={togglePlay}>
            {isPlaying ? <IconPause id="icon-pause" size={30} /> : <IconPlay id="icon-play" size={30} />}
          </button>
          <button id="btn-next" className="ctrl" type="button" aria-label="Siguiente" onClick={playNext}>
            <IconNext size={26} />
          </button>
          <button id="btn-repeat" className="ctrl ctrl-toggle" type="button" aria-label={repeatLabel} data-mode={repeatMode} title="Repetir (R)" onClick={cycleRepeatMode}>
            {repeatMode === "one" ? <IconRepeatOne id="icon-repeat-one" size={20} /> : <IconRepeat id="icon-repeat" size={20} />}
          </button>
          <button
            id="btn-fade"
            className="ctrl ctrl-toggle"
            type="button"
            aria-label={fadeEnabled ? "Modo transición: activado" : "Modo transición: desactivado"}
            aria-pressed={String(fadeEnabled)}
            title="Modo transición: fade de 5 s (T)"
            onClick={toggleFade}
          >
            <IconFade size={20} />
          </button>
        </div>

        <div className="player-right">
          <span className="time">
            <span id="time-current">{formatTime(time.current)}</span> / <span id="time-total">{formatTime(time.duration)}</span>
          </span>
          <div className="volume">
            <button id="btn-mute" className="ctrl" type="button" aria-label="Silenciar" title="Silenciar (M)" onClick={toggleMute}>
              {silent ? <IconMuted id="icon-muted" size={22} /> : <IconVolume id="icon-vol" size={22} />}
            </button>
            <input
              id="volume"
              className="volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={level}
              aria-label="Volumen"
              style={{ "--vol": `${level * 100}%` }}
              onChange={(e) => setVolume(Number(e.target.value))}
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
