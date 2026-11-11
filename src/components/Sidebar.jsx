import { Link, useLocation } from "react-router-dom";
import { useFavorites, useLibrary } from "../context/LibraryContext.jsx";
import { playlistPath } from "./PlaylistCard.jsx";
import { IconHeartNav, IconHome, IconPlay, IconSearch } from "./Icons.jsx";

/* Ruta activa a partir de la URL (#/...) */
export function useActiveRoute() {
  const { pathname } = useLocation();
  const parts = pathname.replace(/^\/+/, "").split("/").map(decodeURIComponent);
  if (parts[0] === "playlist" && parts[1]) return { page: "playlist", id: parts[1] };
  if (parts[0] === "genero" && parts[1]) return { page: "playlist", id: `genero-${parts[1]}` };
  if (parts[0] === "buscar") return { page: "search", q: parts[1] || "" };
  return { page: "home" };
}

export function isNavActive(route, target) {
  if (target === "home") return route.page === "home";
  if (target === "search") return route.page === "search";
  if (target === "playlist:favoritos") return route.page === "playlist" && route.id === "favoritos";
  return false;
}

export default function Sidebar() {
  const route = useActiveRoute();
  const { genrePlaylists, playlists } = useLibrary();
  const favs = useFavorites();

  const navCls = (target) => `side-link${isNavActive(route, target) ? " active" : ""}`;
  const plCls = (id) => `side-pl-link${route.page === "playlist" && route.id === id ? " active" : ""}`;

  return (
    <aside className="sidebar" aria-label="Navegación principal">
      <Link className="logo" to="/" id="logo-link">
        <span className="logo-icon" aria-hidden="true">
          <IconPlay size={18} />
        </span>
        <span>Mi Música</span>
      </Link>

      <nav className="side-nav">
        <Link className={navCls("home")} to="/" id="nav-home">
          <IconHome size={22} />
          Inicio
        </Link>
        <Link className={navCls("search")} to="/buscar" id="nav-search">
          <IconSearch size={22} />
          Buscar
        </Link>
        <Link className={navCls("playlist:favoritos")} to="/playlist/favoritos" id="nav-favorites">
          <IconHeartNav size={22} />
          Tus favoritos
          <span className="side-badge" id="fav-count" hidden={favs.count === 0}>{favs.count}</span>
        </Link>
      </nav>

      <div className="side-section">
        <p className="side-heading">Playlists</p>
        <nav id="side-playlists" className="side-playlists" aria-label="Playlists">
          {/* Enlace a "Todas las canciones" */}
          <Link className={plCls("todas")} to="/playlist/todas">
            <span className="side-pl-link-icon" aria-hidden="true">♫</span>
            <span>Todas las canciones</span>
          </Link>

          {/* Playlists por género auto-generadas */}
          {genrePlaylists.map((g) => (
            <Link key={g.id} className={plCls(g.id)} to={playlistPath(g.id)}>
              <span className="side-pl-link-icon" style={{ color: "var(--accent)" }} aria-hidden="true">#</span>
              <span>{g.name}</span>
            </Link>
          ))}

          {/* Playlists personalizadas */}
          {playlists.map((pl) => (
            <Link key={pl.id} className={plCls(pl.id)} to={playlistPath(pl.id)}>
              <span className="side-pl-link-icon" aria-hidden="true">▶</span>
              <span>{pl.name}</span>
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}

