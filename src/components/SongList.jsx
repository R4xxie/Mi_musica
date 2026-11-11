import { usePlayer } from "../context/PlayerContext.jsx";
import { useFavorites } from "../context/LibraryContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { FALLBACK_COVER, coverFallback, fileNameFor } from "../lib/utils.js";
import { IconDownload, IconHeartFill, IconHeartOutline, IconPause, IconPlay } from "./Icons.jsx";

/* ---------- Botón de favorito (corazón) ---------- */
export function FavButton({ song, size = 20, toastMessages, className = "icon-btn fav-btn", stop = true }) {
  const favs = useFavorites();
  const { showToast } = useToast();
  const isFav = favs.has(song.id);
  const label = isFav ? "Quitar de favoritos" : "Añadir a favoritos";

  return (
    <button
      className={className}
      type="button"
      aria-pressed={String(isFav)}
      aria-label={label}
      title={label}
      onClick={(e) => {
        if (stop) e.stopPropagation();
        const added = favs.toggle(song.id);
        const [onAdd, onRemove] = toastMessages || [
          `Guardado en favoritos: "${song.title}"`,
          `Eliminado de favoritos: "${song.title}"`,
        ];
        showToast(added ? onAdd : onRemove);
      }}
    >
      <IconHeartOutline className="heart-outline" size={size} />
      <IconHeartFill className="heart-fill" size={size} />
    </button>
  );
}

/* ---------- Fila de canción ---------- */
function SongRow({ song, index, showIndex, onPlay }) {
  const { currentSong, isPlaying } = usePlayer();
  const isActive = currentSong?.id === song.id;
  const showPause = isActive && isPlaying;

  return (
    <div className={`song-row${isActive ? " active" : ""}${showPause ? " is-playing" : ""}`} data-song-id={song.id}>
      <div className="song-index" onClick={onPlay}>
        <span className="song-index-num">{showIndex ? index + 1 : "•"}</span>
        <span className="song-play-icon">
          <IconPlay className="song-icon-play" size={18} style={{ display: showPause ? "none" : "inline-block" }} />
          <IconPause className="song-icon-pause" size={18} style={{ display: showPause ? "inline-block" : "none" }} />
        </span>
      </div>
      <div className="song-main" onClick={onPlay}>
        <img className="song-thumb" src={song.cover || FALLBACK_COVER} alt="" loading="lazy" onError={coverFallback} />
        <div className="song-text">
          <p className="song-title">{song.title}</p>
          <p className="song-artist">
            {song.artist}
            {song.genre && <span className="genre-chip">{song.genre}</span>}
          </p>
        </div>
      </div>
      <div className="song-actions">
        <FavButton song={song} />
        <a
          className="icon-btn song-dl-link"
          href={song.src}
          download={fileNameFor(song)}
          aria-label={`Descargar ${song.title}`}
          title="Descargar MP3"
        >
          <IconDownload size={18} />
        </a>
      </div>
      <div className="song-duration">--:--</div>
    </div>
  );
}

/* ---------- Lista de canciones ---------- */
export default function SongList({ songs, showIndex = true }) {
  const { currentSong, togglePlay, playQueue } = usePlayer();

  return (
    <div className="songs-list">
      {songs.map((song, index) => (
        <SongRow
          key={song.id}
          song={song}
          index={index}
          showIndex={showIndex}
          onPlay={() => {
            if (currentSong?.id === song.id) togglePlay();
            else playQueue(songs, index);
          }}
        />
      ))}
    </div>
  );
}

