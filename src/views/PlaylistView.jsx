import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useFavorites, useLibrary } from "../context/LibraryContext.jsx";
import { usePlayer } from "../context/PlayerContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import SongList from "../components/SongList.jsx";
import { firstCoverOf } from "../components/PlaylistCard.jsx";
import { IconDownload, IconHeartFill, IconPause, IconPlay } from "../components/Icons.jsx";
import { FALLBACK_COVER, coverFallback } from "../lib/utils.js";
import { cancelDownload, downloadPlaylistZip, isDownloading } from "../lib/download.js";

/* Resuelve título, descripción y canciones según el id de la URL */
function usePlaylistData(playlistId) {
  const { songs, playlists, genrePlaylists, resolve } = useLibrary();
  const favs = useFavorites();

  if (playlistId === "favoritos") {
    return {
      isFav: true,
      title: "Tus Canciones Favoritas",
      desc: "Guardadas exclusivamente en las cookies de este navegador. Haz clic en el corazón de cualquier canción para añadir o quitar.",
      badge: "Colección Personal",
      list: resolve(favs.ids),
    };
  }
  if (playlistId === "todas") {
    return {
      title: "Todas las canciones",
      desc: `Catálogo completo con ${songs.length} pistas disponibles.`,
      badge: "Catálogo",
      list: songs,
    };
  }
  if (playlistId.startsWith("genero-")) {
    const g = genrePlaylists.find((item) => item.id === playlistId);
    if (g) {
      return {
        title: `Género: ${g.name}`,
        desc: `Selección completa de canciones en estilo ${g.name}.`,
        badge: "Género Musical",
        list: resolve(g.songIds),
      };
    }
  }
  const pl = playlists.find((p) => p.id === playlistId);
  if (pl) {
    return {
      title: pl.name,
      desc: pl.description || `Playlist con ${pl.songIds.length} canciones.`,
      badge: "Playlist",
      list: resolve(pl.songIds),
    };
  }
  return null;
}

export default function PlaylistView() {
  const { id: playlistId = "" } = useParams();
  const data = usePlaylistData(playlistId);
  const { currentSong, isPlaying, togglePlay, playQueue, prefetch } = usePlayer();
  const { showToast } = useToast();

  const [dlLabel, setDlLabel] = useState("Descargar ZIP");
  const [dlBusy, setDlBusy] = useState(isDownloading());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  if (!data) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🔍</div>
        <h3>Playlist o Género no encontrado</h3>
        <p>La categoría que buscas no existe o fue modificada.</p>
        <Link className="btn btn-primary" to="/">Volver al inicio</Link>
      </div>
    );
  }

  const { isFav = false, title, desc, badge, list } = data;
  const empty = list.length === 0;
  const totalCountText = list.length === 1 ? "1 canción" : `${list.length} canciones`;
  const isActivePlaylist = !!currentSong && list.some((s) => s.id === currentSong.id);
  const showPause = isActivePlaylist && isPlaying;

  const onPlayAll = () => {
    if (isActivePlaylist) togglePlay();
    else playQueue(list, 0);
  };

  const onDownload = async () => {
    if (isDownloading()) {
      cancelDownload();
      return;
    }
    setDlBusy(true);
    const res = await downloadPlaylistZip(title, list, (label) => {
      if (mounted.current) setDlLabel(label);
    });
    if (res.single) {
      setDlBusy(false);
      return;
    }
    if (res.ok) {
      showToast(`¡Descarga lista! Se guardó "${res.fileName}"`);
      if (mounted.current) setDlLabel(res.failed ? `Listo (${res.failed} con error)` : "¡Completado!");
    } else {
      showToast(res.cancelled ? "Descarga cancelada" : "Error al descargar canciones");
    }
    if (mounted.current) {
      setDlBusy(false);
      setTimeout(() => { if (mounted.current) setDlLabel("Descargar ZIP"); }, 2500);
    }
  };

  return (
    <div className="playlist-view">
      <header className="pl-header">
        <div className="pl-header-cover-wrap">
          {isFav ? (
            <div className="fav-badge-mosaic"><IconHeartFill size={72} /></div>
          ) : (
            <img className="pl-header-cover" src={firstCoverOf(list) || FALLBACK_COVER} alt={title} onError={coverFallback} />
          )}
        </div>
        <div className="pl-header-info">
          <span className="pl-header-type">{badge}</span>
          <h1 className="pl-header-title">{title}</h1>
          <p className="pl-header-desc">{desc}</p>
          <div className="pl-header-meta">
            <span>{totalCountText}</span>
            {isFav && <span>• Persistido con Cookies 🍪</span>}
          </div>
          <div className="pl-header-actions">
            <button className="btn btn-primary" id="btn-play-playlist" type="button" disabled={empty} aria-label={showPause ? "Pausar" : "Reproducir todo"} onClick={onPlayAll} onPointerEnter={() => !isActivePlaylist && prefetch(list[0])}>
              {showPause ? <IconPause className="pl-btn-icon-pause" size={20} /> : <IconPlay className="pl-btn-icon-play" size={20} />}
              <span id="btn-play-playlist-text">{showPause ? "Pausar" : "Reproducir todo"}</span>
            </button>
            <button
              className={`btn btn-secondary${dlBusy ? " busy" : ""}`}
              id="btn-download-playlist"
              type="button"
              disabled={empty}
              title={dlBusy ? "Clic para cancelar la descarga" : ""}
              onClick={onDownload}
            >
              <IconDownload size={18} />
              <span id="dl-playlist-text">{dlLabel}</span>
            </button>
          </div>
        </div>
      </header>

      <section className="songs-container">
        {empty ? (
          isFav ? (
            <div className="empty-state">
              <div className="empty-icon">🤍</div>
              <h3>Aún no tienes favoritos</h3>
              <p>Explora cualquier canción y pulsa el icono de corazón para guardarla en tus cookies.</p>
              <Link className="btn btn-primary" to="/playlist/todas">Explorar canciones</Link>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🎵</div>
              <h3>Esta lista está vacía</h3>
              <p>No se encontraron canciones asociadas a esta categoría.</p>
            </div>
          )
        ) : (
          <SongList songs={list} showIndex />
        )}
      </section>
    </div>
  );
}

