import { useFavorites, useLibrary, useRecent } from "../context/LibraryContext.jsx";
import PlaylistCard, { firstCoverOf, playlistPath } from "../components/PlaylistCard.jsx";
import SongList from "../components/SongList.jsx";
import { IconHeartFill, IconNote } from "../components/Icons.jsx";

export default function HomeView() {
  const { songs, playlists, genrePlaylists, songMap, resolve } = useLibrary();
  const favs = useFavorites();
  const recentIds = useRecent();
  const recentSongs = recentIds.map((id) => songMap.get(id)).filter(Boolean).slice(0, 6);
  const favCount = favs.count;

  return (
    <div className="home-view">
      <h2 className="section-title">Colecciones Principales</h2>
      <div className="playlists-grid">
        {/* Tarjeta especial: Tus Favoritos */}
        <PlaylistCard
          to="/playlist/favoritos"
          isFav
          title="Tus Favoritos"
          desc={favCount === 1 ? "1 canción guardada en cookies" : `${favCount} canciones guardadas en cookies`}
          playLabel="Abrir favoritos"
          mosaic={<div className="fav-badge-mosaic"><IconHeartFill size={56} /></div>}
        />

        {/* Tarjeta especial: Todas las canciones */}
        <PlaylistCard
          to="/playlist/todas"
          title="Todas las Canciones"
          desc={`Biblioteca completa (${songs.length} canciones)`}
          playLabel="Ver todas"
          mosaic={
            <div className="fav-badge-mosaic" style={{ background: "linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)" }}>
              <IconNote size={52} />
            </div>
          }
        />

        {/* Tarjetas de Playlists fijas */}
        {playlists.map((pl) => {
          const plSongs = resolve(pl.songIds);
          return (
            <PlaylistCard
              key={pl.id}
              to={playlistPath(pl.id)}
              title={pl.name}
              desc={pl.description || `${plSongs.length} canciones`}
              cover={firstCoverOf(plSongs)}
            />
          );
        })}
      </div>

      {/* Sección de Géneros Musicales Auto-detectados */}
      {genrePlaylists.length > 0 && (
        <>
          <h2 className="section-title">Estilos y Géneros (Auto-detectados)</h2>
          <div className="playlists-grid">
            {genrePlaylists.map((g) => {
              const gSongs = resolve(g.songIds);
              return (
                <PlaylistCard
                  key={g.id}
                  to={playlistPath(g.id)}
                  title={g.name}
                  desc={gSongs.length === 1 ? "1 canción disponible" : `${gSongs.length} canciones disponibles`}
                  cover={firstCoverOf(gSongs)}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Sección de recientes */}
      {recentSongs.length > 0 && (
        <div className="recent-section">
          <h2 className="section-title">Escuchado Recientemente</h2>
          <SongList songs={recentSongs} showIndex />
        </div>
      )}
    </div>
  );
}

