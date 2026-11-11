import { useParams } from "react-router-dom";
import { useLibrary } from "../context/LibraryContext.jsx";
import PlaylistCard, { firstCoverOf, playlistPath } from "../components/PlaylistCard.jsx";
import SongList from "../components/SongList.jsx";

const subHeading = { fontSize: "1.15rem", margin: "16px 0 12px", color: "var(--text-muted)" };

export default function SearchView() {
  const { q: rawQuery = "" } = useParams();
  const { songs, genrePlaylists, resolve } = useLibrary();
  const query = rawQuery.trim();

  if (!query) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🔎</div>
        <h3>Encuentra lo que quieras escuchar</h3>
        <p>Escribe el nombre de una canción, artista, género o playlist en el buscador superior.</p>
      </div>
    );
  }

  const q = query.toLowerCase();
  const matchedSongs = songs.filter((s) =>
    s.title.toLowerCase().includes(q) ||
    s.artist.toLowerCase().includes(q) ||
    (s.genre && s.genre.toLowerCase().includes(q))
  );
  const matchedGenres = genrePlaylists.filter((g) => g.name.toLowerCase().includes(q));

  return (
    <div className="search-view">
      <h2 className="section-title">Resultados para "{query}"</h2>

      {matchedGenres.length > 0 && (
        <>
          <h3 style={subHeading}>Géneros encontrados</h3>
          <div className="playlists-grid" style={{ marginBottom: 24 }}>
            {matchedGenres.map((g) => {
              const gSongs = resolve(g.songIds);
              return (
                <PlaylistCard
                  key={g.id}
                  to={playlistPath(g.id)}
                  title={g.name}
                  desc={`${gSongs.length} canciones`}
                  cover={firstCoverOf(gSongs)}
                />
              );
            })}
          </div>
        </>
      )}

      <h3 style={subHeading}>Canciones ({matchedSongs.length})</h3>
      {matchedSongs.length === 0 ? (
        <div className="empty-state" style={{ padding: 30 }}>
          <p>No se encontraron canciones con ese término.</p>
        </div>
      ) : (
        <SongList songs={matchedSongs} showIndex={false} />
      )}
    </div>
  );
}

