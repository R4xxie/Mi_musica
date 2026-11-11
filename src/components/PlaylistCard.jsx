import { Link } from "react-router-dom";
import { FALLBACK_COVER, coverFallback } from "../lib/utils.js";
import { IconPlay } from "./Icons.jsx";

/* Tarjeta de playlist / género. Si recibe `mosaic` muestra ese bloque en vez de la imagen. */
export default function PlaylistCard({ to, title, desc, cover, mosaic, isFav = false, playLabel }) {
  return (
    <Link className={`pl-card${isFav ? " is-fav" : ""}`} to={to}>
      <div className="pl-card-cover-wrap">
        {mosaic || (
          <img className="pl-card-cover" src={cover || FALLBACK_COVER} alt={title} loading="lazy" onError={coverFallback} />
        )}
        <div className="pl-card-overlay">
          <span className="pl-card-play-btn" aria-label={playLabel}>
            <IconPlay size={24} />
          </span>
        </div>
      </div>
      <h3 className="pl-card-title">{title}</h3>
      <p className="pl-card-desc">{desc}</p>
    </Link>
  );
}

export const firstCoverOf = (list) => list.find((s) => s.cover)?.cover || "";
export const playlistPath = (id) => `/playlist/${encodeURIComponent(id)}`;

