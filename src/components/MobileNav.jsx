import { Link } from "react-router-dom";
import { isNavActive, useActiveRoute } from "./Sidebar.jsx";
import { IconHeartNav, IconHome, IconSearch } from "./Icons.jsx";

export default function MobileNav() {
  const route = useActiveRoute();
  const cls = (target) => (isNavActive(route, target) ? "active" : undefined);

  return (
    <nav className="mobile-nav" aria-label="Navegación">
      <Link to="/" className={cls("home")} id="mnav-home">
        <IconHome size={24} />
        Inicio
      </Link>
      <Link to="/buscar" className={cls("search")} id="mnav-search">
        <IconSearch size={24} />
        Buscar
      </Link>
      <Link to="/playlist/favoritos" className={cls("playlist:favoritos")} id="mnav-favorites">
        <IconHeartNav size={24} />
        Favoritos
      </Link>
    </nav>
  );
}

