(() => {
  "use strict";

  /* ---------- Referencias al DOM ---------- */
  const viewContainer   = document.getElementById("view");
  const sidePlaylists   = document.getElementById("side-playlists");
  const navFavorites    = document.getElementById("nav-favorites");
  const favCountBadge   = document.getElementById("fav-count");
  const btnBack         = document.getElementById("btn-back");
  const btnForward      = document.getElementById("btn-forward");
  const searchForm      = document.getElementById("search-form");
  const searchInput     = document.getElementById("search-input");
  const cookieBanner    = document.getElementById("cookie-banner");
  const cookieAccept    = document.getElementById("cookie-accept");
  const toastEl         = document.getElementById("toast");

  // Reproductor
  const playerCover     = document.getElementById("player-cover");
  const playerTitle     = document.getElementById("player-title");
  const playerArtist    = document.getElementById("player-artist");
  const btnFavCurrent   = document.getElementById("btn-fav-current");
  const btnPlay         = document.getElementById("btn-play");
  const btnPrev         = document.getElementById("btn-prev");
  const btnNext         = document.getElementById("btn-next");
  const btnShuffle      = document.getElementById("btn-shuffle");
  const btnRepeat       = document.getElementById("btn-repeat");
  const iconRepeat      = document.getElementById("icon-repeat");
  const iconRepeatOne   = document.getElementById("icon-repeat-one");
  const iconPlay        = document.getElementById("icon-play");
  const iconPause       = document.getElementById("icon-pause");
  const progress        = document.getElementById("progress");
  const progressFill    = document.getElementById("progress-fill");
  const progressBuffer  = document.getElementById("progress-buffer");
  const progressThumb   = document.getElementById("progress-thumb");
  const timeCurrent     = document.getElementById("time-current");
  const timeTotal       = document.getElementById("time-total");
  const volume          = document.getElementById("volume");
  const btnMute         = document.getElementById("btn-mute");
  const iconVol         = document.getElementById("icon-vol");
  const iconMuted       = document.getElementById("icon-muted");

  /* ---------- Estado ---------- */
  const audio = new Audio();
  audio.preload = "metadata";

  let songs = [];         // Catálogo completo [{ id, title, artist, genre, cover, src }]
  let songMap = new Map();// Map id -> song
  let playlists = [];     // Playlists estáticas / de base de datos
  let genrePlaylists = [];// Playlists dinámicas auto-generadas a partir de los géneros

  let queue = [];         // Canciones en cola de reproducción
  let originalQueue = []; // Cola original antes de mezclar (shuffle)
  let queueIndex = -1;
  let isDraggingProgress = false;
  let isShuffle = false;
  let repeatMode = "off"; // "off" | "all" | "one"
  let consecutiveErrors = 0;
  let downloadCtrl = null;// Cancelar descarga ZIP en curso

  const currentSong = () => (queueIndex >= 0 && queueIndex < queue.length ? queue[queueIndex] : null);

  // SVG de respaldo cuando la carátula no existe o falla al cargar
  const FALLBACK_COVER = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#2a1226"/>
          <stop offset="100%" stop-color="#121324"/>
        </linearGradient>
      </defs>
      <rect width="200" height="200" fill="url(#g)"/>
      <circle cx="100" cy="100" r="46" fill="rgba(255,255,255,0.06)"/>
      <path fill="#ff2a5f" d="M88 64v50a18 18 0 1 0 12 17V84h24V64z"/>
    </svg>
  `);

  /* ---------- Utilidades ---------- */
  const formatTime = (s) => {
    if (!Number.isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const sanitize = (s) =>
    String(s || "").replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").replace(/\s+/g, " ").trim().slice(0, 100) || "pista";

  const extOf = (src) => {
    const m = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(src || "");
    return m ? m[1].toLowerCase() : "mp3";
  };

  const fileNameFor = (song) => `${sanitize(`${song.artist} - ${song.title}`)}.${extOf(song.src)}`;

  function setCover(img, src) {
    if (!img) return;
    img.onerror = () => {
      img.onerror = null;
      img.src = FALLBACK_COVER;
    };
    img.src = src && src.trim() ? src : FALLBACK_COVER;
  }

  let toastTimer = null;
  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.hidden = false;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("show");
      setTimeout(() => { toastEl.hidden = true; }, 300);
    }, 2500);
  }

  /* ---------- Auto-descubrimiento Dinámico de Géneros ---------- */
  function buildGenrePlaylists() {
    const map = new Map();
    songs.forEach((song) => {
      const g = (song.genre || "Otros").trim();
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(song.id);
    });

    genrePlaylists = Array.from(map.entries()).map(([name, songIds]) => {
      return {
        id: `genero-${window.DataSource.slugify(name)}`,
        rawGenre: name,
        name: name,
        description: `Todas las canciones de ${name} (${songIds.length})`,
        songIds: songIds,
        isGenre: true,
      };
    });
  }

  /* ---------- Gestión de Cookies e Identidad ---------- */
  function updateFavBadge() {
    const count = window.Store.favorites.count();
    if (favCountBadge) {
      favCountBadge.textContent = count;
      favCountBadge.hidden = count === 0;
    }
    const current = currentSong();
    if (current && btnFavCurrent) {
      const isFav = window.Store.favorites.has(current.id);
      btnFavCurrent.setAttribute("aria-pressed", String(isFav));
      btnFavCurrent.title = isFav ? "Quitar de favoritos" : "Añadir a favoritos";
    }
  }

  function setupCookiesUI() {
    window.Store.userId();

    if (!window.Store.consent.seen()) {
      cookieBanner.hidden = false;
      cookieAccept.addEventListener("click", () => {
        window.Store.consent.accept();
        cookieBanner.hidden = true;
      });
    }

    window.addEventListener("store:favorites", (e) => {
      updateFavBadge();
      const route = getRoute();
      if (route.page === "playlist" && route.id === "favoritos") {
        renderPlaylistView("favoritos");
      } else {
        document.querySelectorAll(`.fav-btn[data-song-id]`).forEach((btn) => {
          const id = btn.dataset.songId;
          const isFav = window.Store.favorites.has(id);
          btn.setAttribute("aria-pressed", String(isFav));
        });
      }
    });

    const savedVol = window.Store.prefs.get("vol", 0.8);
    audio.volume = savedVol;
    volume.value = savedVol;
    updateVolumeUI();

    isShuffle = !!window.Store.prefs.get("shuffle", false);
    btnShuffle.setAttribute("aria-pressed", String(isShuffle));

    repeatMode = window.Store.prefs.get("repeat", "off");
    applyRepeatModeUI(repeatMode);
  }

  /* ---------- Enrutador Hash (#/...) ---------- */
  function getRoute() {
    const hash = location.hash.replace(/^#\/?/, "");
    if (!hash) return { page: "home" };
    const parts = hash.split("/").map(decodeURIComponent);
    if (parts[0] === "playlist" && parts[1]) {
      return { page: "playlist", id: parts[1] };
    }
    if (parts[0] === "genero" && parts[1]) {
      return { page: "playlist", id: `genero-${parts[1]}` };
    }
    if (parts[0] === "buscar") {
      return { page: "search", q: parts[1] || "" };
    }
    return { page: "home" };
  }

  function navigate(hash) {
    location.hash = hash;
  }

  function updateActiveNavLinks(route) {
    document.querySelectorAll("[data-route]").forEach((link) => {
      const target = link.dataset.route;
      let active = false;
      if (route.page === "home" && target === "home") active = true;
      if (route.page === "search" && target === "search") active = true;
      if (route.page === "playlist" && route.id === "favoritos" && target === "playlist:favoritos") active = true;
      link.classList.toggle("active", active);
    });

    document.querySelectorAll(".side-pl-link").forEach((link) => {
      const plId = link.dataset.plId;
      link.classList.toggle("active", route.page === "playlist" && route.id === plId);
    });
  }

  function handleRoute() {
    const route = getRoute();
    updateActiveNavLinks(route);

    if (route.page === "home") {
      renderHomeView();
    } else if (route.page === "playlist") {
      renderPlaylistView(route.id);
    } else if (route.page === "search") {
      renderSearchView(route.q);
    } else {
      renderHomeView();
    }
    viewContainer.scrollTop = 0;
  }

  /* ---------- Render: Barra Lateral de Playlists y Géneros ---------- */
  function renderSidebarPlaylists() {
    sidePlaylists.innerHTML = "";
    
    // Enlace a "Todas las canciones"
    const allLink = document.createElement("a");
    allLink.className = "side-pl-link";
    allLink.href = "#/playlist/todas";
    allLink.dataset.plId = "todas";
    allLink.innerHTML = `
      <span class="side-pl-link-icon" aria-hidden="true">♫</span>
      <span>Todas las canciones</span>
    `;
    sidePlaylists.appendChild(allLink);

    // Playlists por género auto-generadas
    if (genrePlaylists.length > 0) {
      genrePlaylists.forEach((g) => {
        const a = document.createElement("a");
        a.className = "side-pl-link";
        a.href = `#/playlist/${encodeURIComponent(g.id)}`;
        a.dataset.plId = g.id;
        a.innerHTML = `
          <span class="side-pl-link-icon" style="color: var(--accent);" aria-hidden="true">#</span>
          <span>${escapeHtml(g.name)}</span>
        `;
        sidePlaylists.appendChild(a);
      });
    }

    // Playlists personalizadas
    playlists.forEach((pl) => {
      const a = document.createElement("a");
      a.className = "side-pl-link";
      a.href = `#/playlist/${encodeURIComponent(pl.id)}`;
      a.dataset.plId = pl.id;
      a.innerHTML = `
        <span class="side-pl-link-icon" aria-hidden="true">▶</span>
        <span>${escapeHtml(pl.name)}</span>
      `;
      sidePlaylists.appendChild(a);
    });
  }

  /* ---------- Render: Vista de Inicio (Home) ---------- */
  function renderHomeView() {
    const favCount = window.Store.favorites.count();
    const recentIds = window.Store.recent.all();
    const recentSongs = recentIds.map((id) => songMap.get(id)).filter(Boolean).slice(0, 6);

    let html = `
      <div class="home-view">
        <h2 class="section-title">Colecciones Principales</h2>
        <div class="playlists-grid">
          <!-- Tarjeta especial: Tus Favoritos -->
          <a class="pl-card is-fav" href="#/playlist/favoritos">
            <div class="pl-card-cover-wrap">
              <div class="fav-badge-mosaic">
                <svg viewBox="0 0 24 24" width="56" height="56"><path fill="currentColor" d="m12 21.4-1.4-1.3C5.4 15.4 2 12.3 2 8.5A5.4 5.4 0 0 1 7.5 3c1.7 0 3.4.8 4.5 2.1A6 6 0 0 1 16.5 3 5.4 5.4 0 0 1 22 8.5c0 3.8-3.4 6.9-8.6 11.6z"/></svg>
              </div>
              <div class="pl-card-overlay">
                <span class="pl-card-play-btn" aria-label="Abrir favoritos">
                  <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
                </span>
              </div>
            </div>
            <h3 class="pl-card-title">Tus Favoritos</h3>
            <p class="pl-card-desc">${favCount === 1 ? "1 canción guardada en cookies" : `${favCount} canciones guardadas en cookies`}</p>
          </a>

          <!-- Tarjeta especial: Todas las canciones -->
          <a class="pl-card" href="#/playlist/todas">
            <div class="pl-card-cover-wrap">
              <div class="fav-badge-mosaic" style="background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);">
                <svg viewBox="0 0 24 24" width="52" height="52"><path fill="currentColor" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
              </div>
              <div class="pl-card-overlay">
                <span class="pl-card-play-btn" aria-label="Ver todas">
                  <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
                </span>
              </div>
            </div>
            <h3 class="pl-card-title">Todas las Canciones</h3>
            <p class="pl-card-desc">Biblioteca completa (${songs.length} canciones)</p>
          </a>
    `;

    // Tarjetas de Playlists fijas
    playlists.forEach((pl) => {
      const plSongs = pl.songIds.map((id) => songMap.get(id)).filter(Boolean);
      const firstCover = plSongs.find((s) => s.cover)?.cover || "";
      
      html += `
        <a class="pl-card" href="#/playlist/${encodeURIComponent(pl.id)}">
          <div class="pl-card-cover-wrap">
            <img class="pl-card-cover" src="${escapeHtml(firstCover || FALLBACK_COVER)}" alt="${escapeHtml(pl.name)}" loading="lazy" />
            <div class="pl-card-overlay">
              <span class="pl-card-play-btn">
                <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
              </span>
            </div>
          </div>
          <h3 class="pl-card-title">${escapeHtml(pl.name)}</h3>
          <p class="pl-card-desc">${escapeHtml(pl.description || `${plSongs.length} canciones`)}</p>
        </a>
      `;
    });

    html += `</div>`;

    // Sección de Géneros Musicales Auto-detectados
    if (genrePlaylists.length > 0) {
      html += `
        <h2 class="section-title">Estilos y Géneros (Auto-detectados)</h2>
        <div class="playlists-grid">
      `;

      genrePlaylists.forEach((g) => {
        const gSongs = g.songIds.map((id) => songMap.get(id)).filter(Boolean);
        const firstCover = gSongs.find((s) => s.cover)?.cover || "";
        html += `
          <a class="pl-card" href="#/playlist/${encodeURIComponent(g.id)}">
            <div class="pl-card-cover-wrap">
              <img class="pl-card-cover" src="${escapeHtml(firstCover || FALLBACK_COVER)}" alt="${escapeHtml(g.name)}" loading="lazy" />
              <div class="pl-card-overlay">
                <span class="pl-card-play-btn"><svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg></span>
              </div>
            </div>
            <h3 class="pl-card-title">${escapeHtml(g.name)}</h3>
            <p class="pl-card-desc">${gSongs.length === 1 ? "1 canción disponible" : `${gSongs.length} canciones disponibles`}</p>
          </a>
        `;
      });

      html += `</div>`;
    }

    // Sección de recientes
    if (recentSongs.length > 0) {
      html += `
        <div class="recent-section">
          <h2 class="section-title">Escuchado Recientemente</h2>
          <div class="songs-list" id="recent-songs-list"></div>
        </div>
      `;
    }

    html += `</div>`;
    viewContainer.innerHTML = html;

    if (recentSongs.length > 0) {
      const recentListContainer = document.getElementById("recent-songs-list");
      renderSongRows(recentSongs, recentListContainer, { showIndex: true });
    }
  }

  /* ---------- Render: Vista Detalle de Playlist o Género ---------- */
  function renderPlaylistView(playlistId) {
    let title = "";
    let desc = "";
    let badgeText = "Playlist";
    let isFavPlaylist = false;
    let plSongs = [];

    if (playlistId === "favoritos") {
      isFavPlaylist = true;
      title = "Tus Canciones Favoritas";
      desc = "Guardadas exclusivamente en las cookies de este navegador. Haz clic en el corazón de cualquier canción para añadir o quitar.";
      badgeText = "Colección Personal";
      const favIds = window.Store.favorites.all();
      plSongs = favIds.map((id) => songMap.get(id)).filter(Boolean);
    } else if (playlistId === "todas") {
      title = "Todas las canciones";
      desc = `Catálogo completo con ${songs.length} pistas disponibles.`;
      badgeText = "Catálogo";
      plSongs = songs.slice();
    } else if (playlistId.startsWith("genero-")) {
      const g = genrePlaylists.find((item) => item.id === playlistId);
      if (g) {
        title = `Género: ${g.name}`;
        desc = `Selección completa de canciones en estilo ${g.name}.`;
        badgeText = "Género Musical";
        plSongs = g.songIds.map((id) => songMap.get(id)).filter(Boolean);
      }
    } else {
      const pl = playlists.find((p) => p.id === playlistId);
      if (pl) {
        title = pl.name;
        desc = pl.description || `Playlist con ${pl.songIds.length} canciones.`;
        plSongs = pl.songIds.map((id) => songMap.get(id)).filter(Boolean);
      }
    }

    if (!title && plSongs.length === 0) {
      viewContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3>Playlist o Género no encontrado</h3>
          <p>La categoría que buscas no existe o fue modificada.</p>
          <a class="btn btn-primary" href="#/">Volver al inicio</a>
        </div>
      `;
      return;
    }

    const firstCover = plSongs.find((s) => s.cover)?.cover || "";
    const totalCountText = plSongs.length === 1 ? "1 canción" : `${plSongs.length} canciones`;

    let html = `
      <div class="playlist-view">
        <header class="pl-header">
          <div class="pl-header-cover-wrap">
            ${isFavPlaylist
              ? `<div class="fav-badge-mosaic"><svg viewBox="0 0 24 24" width="72" height="72"><path fill="currentColor" d="m12 21.4-1.4-1.3C5.4 15.4 2 12.3 2 8.5A5.4 5.4 0 0 1 7.5 3c1.7 0 3.4.8 4.5 2.1A6 6 0 0 1 16.5 3 5.4 5.4 0 0 1 22 8.5c0 3.8-3.4 6.9-8.6 11.6z"/></svg></div>`
              : `<img class="pl-header-cover" src="${escapeHtml(firstCover || FALLBACK_COVER)}" alt="${escapeHtml(title)}" />`
            }
          </div>
          <div class="pl-header-info">
            <span class="pl-header-type">${badgeText}</span>
            <h1 class="pl-header-title">${escapeHtml(title)}</h1>
            <p class="pl-header-desc">${escapeHtml(desc)}</p>
            <div class="pl-header-meta">
              <span>${totalCountText}</span>
              ${isFavPlaylist ? `<span>• Persistido con Cookies 🍪</span>` : ""}
            </div>
            <div class="pl-header-actions">
              <button class="btn btn-primary" id="btn-play-playlist" type="button" ${plSongs.length === 0 ? "disabled" : ""}>
                <svg class="pl-btn-icon-play" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
                <svg class="pl-btn-icon-pause" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style="display:none;"><path fill="currentColor" d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
                <span id="btn-play-playlist-text">Reproducir todo</span>
              </button>
              <button class="btn btn-secondary" id="btn-download-playlist" type="button" ${plSongs.length === 0 ? "disabled" : ""}>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M11 4h2v8.2l3.3-3.3 1.4 1.4L12 16l-5.7-5.7 1.4-1.4 3.3 3.3zM5 18h14v2H5z"/></svg>
                <span id="dl-playlist-text">Descargar ZIP</span>
              </button>
            </div>
          </div>
        </header>

        <section class="songs-container">
    `;

    if (plSongs.length === 0) {
      if (isFavPlaylist) {
        html += `
          <div class="empty-state">
            <div class="empty-icon">🤍</div>
            <h3>Aún no tienes favoritos</h3>
            <p>Explora cualquier canción y pulsa el icono de corazón para guardarla en tus cookies.</p>
            <a class="btn btn-primary" href="#/playlist/todas">Explorar canciones</a>
          </div>
        `;
      } else {
        html += `
          <div class="empty-state">
            <div class="empty-icon">🎵</div>
            <h3>Esta lista está vacía</h3>
            <p>No se encontraron canciones asociadas a esta categoría.</p>
          </div>
        `;
      }
    } else {
      html += `<div class="songs-list" id="pl-songs-list"></div>`;
    }

    html += `</section></div>`;
    viewContainer.innerHTML = html;

    const btnPlayPl = document.getElementById("btn-play-playlist");
    if (btnPlayPl && plSongs.length > 0) {
      btnPlayPl.addEventListener("click", () => {
        const current = currentSong();
        if (current && plSongs.some((s) => s.id === current.id)) {
          togglePlay();
        } else {
          playQueue(plSongs, 0);
        }
      });
      updatePlaylistPlayButton();
    }

    const btnDlPl = document.getElementById("btn-download-playlist");
    const dlPlText = document.getElementById("dl-playlist-text");
    if (btnDlPl && plSongs.length > 0) {
      btnDlPl.addEventListener("click", () => downloadPlaylistZip(title, plSongs, btnDlPl, dlPlText));
    }

    if (plSongs.length > 0) {
      const listEl = document.getElementById("pl-songs-list");
      renderSongRows(plSongs, listEl, { showIndex: true });
    }
  }

  /* ---------- Render: Vista de Búsqueda ---------- */
  function renderSearchView(query) {
    query = (query || "").trim();
    searchInput.value = query;

    if (!query) {
      viewContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔎</div>
          <h3>Encuentra lo que quieras escuchar</h3>
          <p>Escribe el nombre de una canción, artista, género o playlist en el buscador superior.</p>
        </div>
      `;
      return;
    }

    const q = query.toLowerCase();
    const matchedSongs = songs.filter((s) =>
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q) ||
      (s.genre && s.genre.toLowerCase().includes(q))
    );

    const matchedGenres = genrePlaylists.filter((g) => g.name.toLowerCase().includes(q));

    let html = `
      <div class="search-view">
        <h2 class="section-title">Resultados para "${escapeHtml(query)}"</h2>
    `;

    if (matchedGenres.length > 0) {
      html += `
        <h3 style="font-size: 1.15rem; margin: 16px 0 12px; color: var(--text-muted);">Géneros encontrados</h3>
        <div class="playlists-grid" style="margin-bottom: 24px;">
      `;
      matchedGenres.forEach((g) => {
        const gSongs = g.songIds.map((id) => songMap.get(id)).filter(Boolean);
        const firstCover = gSongs.find((s) => s.cover)?.cover || "";
        html += `
          <a class="pl-card" href="#/playlist/${encodeURIComponent(g.id)}">
            <div class="pl-card-cover-wrap">
              <img class="pl-card-cover" src="${escapeHtml(firstCover || FALLBACK_COVER)}" alt="" loading="lazy" />
              <div class="pl-card-overlay">
                <span class="pl-card-play-btn"><svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg></span>
              </div>
            </div>
            <h3 class="pl-card-title">${escapeHtml(g.name)}</h3>
            <p class="pl-card-desc">${gSongs.length} canciones</p>
          </a>
        `;
      });
      html += `</div>`;
    }

    html += `<h3 style="font-size: 1.15rem; margin: 16px 0 12px; color: var(--text-muted);">Canciones (${matchedSongs.length})</h3>`;
    if (matchedSongs.length === 0) {
      html += `
        <div class="empty-state" style="padding: 30px;">
          <p>No se encontraron canciones con ese término.</p>
        </div>
      `;
    } else {
      html += `<div class="songs-list" id="search-songs-list"></div>`;
    }

    html += `</div>`;
    viewContainer.innerHTML = html;

    if (matchedSongs.length > 0) {
      const listEl = document.getElementById("search-songs-list");
      renderSongRows(matchedSongs, listEl, { showIndex: false });
    }
  }

  /* ---------- Render: Filas de Canciones ---------- */
  function renderSongRows(songList, container, { showIndex = true } = {}) {
    if (!container) return;
    container.innerHTML = "";
    const active = currentSong();

    songList.forEach((song, index) => {
      const row = document.createElement("div");
      row.className = "song-row";
      row.dataset.songId = song.id;
      
      const isActive = active && active.id === song.id;
      if (isActive) {
        row.classList.add("active");
        if (!audio.paused) row.classList.add("is-playing");
      }

      const isFav = window.Store.favorites.has(song.id);

      row.innerHTML = `
        <div class="song-index">
          <span class="song-index-num">${showIndex ? index + 1 : "•"}</span>
          <span class="song-play-icon">
            <svg class="song-icon-play" viewBox="0 0 24 24" width="18" height="18" style="${isActive && !audio.paused ? "display:none;" : ""}"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
            <svg class="song-icon-pause" viewBox="0 0 24 24" width="18" height="18" style="${isActive && !audio.paused ? "" : "display:none;"}"><path fill="currentColor" d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
          </span>
        </div>
        <div class="song-main">
          <img class="song-thumb" src="${escapeHtml(song.cover || FALLBACK_COVER)}" alt="" loading="lazy" />
          <div class="song-text">
            <p class="song-title">${escapeHtml(song.title)}</p>
            <p class="song-artist">
              ${escapeHtml(song.artist)}
              ${song.genre ? `<span style="display:inline-block; margin-left:8px; font-size:0.75rem; padding:1px 6px; border-radius:4px; background:rgba(255,255,255,0.08); color:var(--text-subtle);">${escapeHtml(song.genre)}</span>` : ""}
            </p>
          </div>
        </div>
        <div class="song-actions">
          <button class="icon-btn fav-btn" data-song-id="${song.id}" type="button" aria-pressed="${String(isFav)}" aria-label="${isFav ? "Quitar de favoritos" : "Añadir a favoritos"}" title="${isFav ? "Quitar de favoritos" : "Añadir a favoritos"}">
            <svg class="heart-outline" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M16.5 3c-1.7 0-3.4.8-4.5 2.1A6 6 0 0 0 7.5 3 5.4 5.4 0 0 0 2 8.5c0 3.8 3.4 6.9 8.6 11.5l1.4 1.3 1.4-1.3C18.6 15.4 22 12.3 22 8.5A5.4 5.4 0 0 0 16.5 3m-4.4 15.6-.1.1-.1-.1C7.1 14.2 4 11.4 4 8.5 4 6.5 5.5 5 7.5 5c1.5 0 3 1 3.6 2.4h1.9C13.5 6 15 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.9-3.1 5.7-7.9 10.1"/></svg>
            <svg class="heart-fill" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="m12 21.4-1.4-1.3C5.4 15.4 2 12.3 2 8.5A5.4 5.4 0 0 1 7.5 3c1.7 0 3.4.8 4.5 2.1A6 6 0 0 1 16.5 3 5.4 5.4 0 0 1 22 8.5c0 3.8-3.4 6.9-8.6 11.6z"/></svg>
          </button>
          <a class="icon-btn song-dl-link" href="${escapeHtml(song.src)}" download="${escapeHtml(fileNameFor(song))}" aria-label="Descargar ${escapeHtml(song.title)}" title="Descargar MP3">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M11 4h2v8.2l3.3-3.3 1.4 1.4L12 16l-5.7-5.7 1.4-1.4 3.3 3.3zM5 18h14v2H5z"/></svg>
          </a>
        </div>
        <div class="song-duration">--:--</div>
      `;

      const mainBtn = row.querySelector(".song-main");
      const indexBtn = row.querySelector(".song-index");
      const playHandler = () => {
        const current = currentSong();
        if (current && current.id === song.id) {
          togglePlay();
        } else {
          playQueue(songList, index);
        }
      };
      mainBtn.addEventListener("click", playHandler);
      indexBtn.addEventListener("click", playHandler);

      const favBtn = row.querySelector(".fav-btn");
      favBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const added = window.Store.favorites.toggle(song.id);
        favBtn.setAttribute("aria-pressed", String(added));
        showToast(added ? `Guardado en favoritos: "${song.title}"` : `Eliminado de favoritos: "${song.title}"`);
      });

      container.appendChild(row);
    });
  }

  /* ---------- Lógica de Reproducción ---------- */
  function playQueue(list, startIndex = 0) {
    if (!list || !list.length) return;
    originalQueue = list.slice();

    if (isShuffle) {
      const selected = list[startIndex];
      const rest = list.filter((_, i) => i !== startIndex);
      shuffleArray(rest);
      queue = [selected, ...rest];
      queueIndex = 0;
    } else {
      queue = originalQueue.slice();
      queueIndex = startIndex;
    }

    playCurrent();
  }

  function playCurrent() {
    const song = currentSong();
    if (!song) return;

    audio.src = song.src;
    setPlayingUI(true);
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setPlayingUI(true))
        .catch((err) => {
          console.warn("Reproducción en espera o bloqueada:", err);
          setPlayingUI(false);
        });
    }

    updatePlayerUI(song);
    updateActiveRows();
    window.Store.recent.push(song.id);

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: song.artist,
        artwork: [
          { src: song.cover || FALLBACK_COVER, sizes: "512x512", type: "image/jpeg" }
        ]
      });
    }
  }

  function togglePlay() {
    if (!currentSong()) {
      if (songs.length) playQueue(songs, 0);
      return;
    }
    if (audio.paused) {
      setPlayingUI(true);
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setPlayingUI(true))
          .catch((err) => {
            console.warn("Error al reproducir:", err);
            setPlayingUI(false);
          });
      }
    } else {
      audio.pause();
      setPlayingUI(false);
    }
  }

  function playNext() {
    if (!queue.length) return;
    if (repeatMode === "one") {
      audio.currentTime = 0;
      audio.play().catch(console.warn);
      return;
    }
    const nextIdx = queueIndex + 1;
    if (nextIdx < queue.length) {
      queueIndex = nextIdx;
      playCurrent();
    } else {
      if (repeatMode === "all") {
        queueIndex = 0;
        playCurrent();
      } else {
        audio.pause();
        audio.currentTime = 0;
        setPlayingUI(false);
      }
    }
  }

  function playPrev() {
    if (!queue.length) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    queueIndex = queueIndex <= 0 ? (repeatMode === "all" ? queue.length - 1 : 0) : queueIndex - 1;
    playCurrent();
  }

  function toggleShuffle() {
    isShuffle = !isShuffle;
    btnShuffle.setAttribute("aria-pressed", String(isShuffle));
    window.Store.prefs.set("shuffle", isShuffle);

    const current = currentSong();
    if (isShuffle) {
      const rest = queue.filter((s) => s !== current);
      shuffleArray(rest);
      queue = current ? [current, ...rest] : rest;
      queueIndex = current ? 0 : -1;
      showToast("Aleatorio activado");
    } else {
      queue = originalQueue.slice();
      queueIndex = current ? queue.indexOf(current) : 0;
      showToast("Aleatorio desactivado");
    }
  }

  function cycleRepeatMode() {
    if (repeatMode === "off") repeatMode = "all";
    else if (repeatMode === "all") repeatMode = "one";
    else repeatMode = "off";

    applyRepeatModeUI(repeatMode);
    window.Store.prefs.set("repeat", repeatMode);
    showToast(repeatMode === "one" ? "Repetir una canción" : repeatMode === "all" ? "Repetir lista" : "Repetición apagada");
  }

  function applyRepeatModeUI(mode) {
    btnRepeat.dataset.mode = mode;
    if (mode === "one") {
      iconRepeat.hidden = true;
      iconRepeatOne.hidden = false;
      btnRepeat.setAttribute("aria-label", "Repetir: una canción");
    } else {
      iconRepeat.hidden = false;
      iconRepeatOne.hidden = true;
      btnRepeat.setAttribute("aria-label", mode === "all" ? "Repetir: todas" : "Repetir: desactivado");
    }
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function updatePlayerUI(song) {
    playerTitle.textContent = song.title;
    playerArtist.textContent = song.artist;
    setCover(playerCover, song.cover);
    playerCover.hidden = false;
    document.title = `${song.title} • ${song.artist}`;

    btnFavCurrent.hidden = false;
    const isFav = window.Store.favorites.has(song.id);
    btnFavCurrent.setAttribute("aria-pressed", String(isFav));
    btnFavCurrent.title = isFav ? "Quitar de favoritos" : "Añadir a favoritos";
  }

  function updatePlaylistPlayButton(playing = !audio.paused) {
    const btnPlayPl = document.getElementById("btn-play-playlist");
    if (!btnPlayPl) return;
    const playSvg = btnPlayPl.querySelector(".pl-btn-icon-play");
    const pauseSvg = btnPlayPl.querySelector(".pl-btn-icon-pause");
    const textSpan = btnPlayPl.querySelector("#btn-play-playlist-text") || btnPlayPl.querySelector("span");

    const current = currentSong();
    let isCurrentPlaylistActive = false;
    if (current) {
      const hash = window.location.hash || "#/";
      const match = hash.match(/^#\/playlist\/(.+)$/);
      if (match) {
        const plId = decodeURIComponent(match[1]);
        if (plId === "todas") {
          isCurrentPlaylistActive = true;
        } else if (plId === "favoritos") {
          isCurrentPlaylistActive = window.Store.favorites.has(current.id);
        } else {
          const pl = playlists.find((p) => p.id === plId) || genrePlaylists.find((g) => g.id === plId);
          if (pl && pl.songIds) {
            isCurrentPlaylistActive = pl.songIds.includes(current.id);
          }
        }
      }
    }

    if (isCurrentPlaylistActive && playing) {
      if (playSvg) playSvg.style.display = "none";
      if (pauseSvg) pauseSvg.style.display = "inline-block";
      if (textSpan) textSpan.textContent = "Pausar";
      btnPlayPl.setAttribute("aria-label", "Pausar");
    } else {
      if (playSvg) playSvg.style.display = "inline-block";
      if (pauseSvg) pauseSvg.style.display = "none";
      if (textSpan) textSpan.textContent = "Reproducir todo";
      btnPlayPl.setAttribute("aria-label", "Reproducir todo");
    }
  }

  function setPlayingUI(playing) {
    if (iconPlay) {
      iconPlay.hidden = playing;
      iconPlay.style.display = playing ? "none" : "";
    }
    if (iconPause) {
      iconPause.hidden = !playing;
      iconPause.style.display = playing ? "" : "none";
    }
    btnPlay.setAttribute("aria-label", playing ? "Pausar" : "Reproducir");
    btnPlay.classList.toggle("is-playing", playing);
    updateActiveRows();
    updatePlaylistPlayButton(playing);
  }

  function updateActiveRows() {
    const current = currentSong();
    const isPlaying = !audio.paused;
    document.querySelectorAll(".song-row").forEach((row) => {
      const isCurrent = current && row.dataset.songId === current.id;
      row.classList.toggle("active", isCurrent);
      row.classList.toggle("is-playing", isCurrent && isPlaying);

      const playSvg = row.querySelector(".song-icon-play");
      const pauseSvg = row.querySelector(".song-icon-pause");
      if (playSvg && pauseSvg) {
        if (isCurrent && isPlaying) {
          playSvg.style.display = "none";
          pauseSvg.style.display = "inline-block";
        } else {
          playSvg.style.display = "inline-block";
          pauseSvg.style.display = "none";
        }
      }
    });
  }

  function setProgressUI(percent) {
    const p = Math.min(100, Math.max(0, percent));
    progressFill.style.width = `${p}%`;
    progressThumb.style.left = `${p}%`;
    progress.setAttribute("aria-valuenow", Math.round(p));
  }

  function seekFromEvent(e) {
    if (!Number.isFinite(audio.duration)) return;
    const rect = progress.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setProgressUI(ratio * 100);
    timeCurrent.textContent = formatTime(ratio * audio.duration);
    return ratio;
  }

  progress.addEventListener("pointerdown", (e) => {
    if (!currentSong()) return;
    isDraggingProgress = true;
    progress.classList.add("dragging");
    progress.setPointerCapture(e.pointerId);
    seekFromEvent(e);
  });

  progress.addEventListener("pointermove", (e) => {
    if (isDraggingProgress) seekFromEvent(e);
  });

  progress.addEventListener("pointerup", (e) => {
    if (!isDraggingProgress) return;
    isDraggingProgress = false;
    progress.classList.remove("dragging");
    const ratio = seekFromEvent(e);
    if (ratio !== undefined) audio.currentTime = ratio * audio.duration;
  });

  progress.addEventListener("pointercancel", () => {
    isDraggingProgress = false;
    progress.classList.remove("dragging");
  });

  audio.addEventListener("play", () => setPlayingUI(true));
  audio.addEventListener("pause", () => setPlayingUI(false));
  audio.addEventListener("playing", () => { consecutiveErrors = 0; });

  audio.addEventListener("loadedmetadata", () => {
    timeTotal.textContent = formatTime(audio.duration);
  });

  audio.addEventListener("timeupdate", () => {
    if (isDraggingProgress || !Number.isFinite(audio.duration)) return;
    setProgressUI((audio.currentTime / audio.duration) * 100);
    timeCurrent.textContent = formatTime(audio.currentTime);

    if (audio.buffered.length > 0) {
      const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
      const bufferPct = Math.min(100, (bufferedEnd / audio.duration) * 100);
      progressBuffer.style.width = `${bufferPct}%`;
    }
  });

  audio.addEventListener("ended", playNext);

  audio.addEventListener("error", () => {
    console.error("Error al cargar pista:", audio.src);
    consecutiveErrors++;
    setPlayingUI(false);
    if (consecutiveErrors < queue.length) {
      playNext();
    } else {
      consecutiveErrors = 0;
      playerArtist.textContent = "Error al reproducir audio";
    }
  });

  btnPlay.addEventListener("click", togglePlay);
  btnNext.addEventListener("click", playNext);
  btnPrev.addEventListener("click", playPrev);
  btnShuffle.addEventListener("click", toggleShuffle);
  btnRepeat.addEventListener("click", cycleRepeatMode);

  btnFavCurrent.addEventListener("click", () => {
    const current = currentSong();
    if (!current) return;
    const added = window.Store.favorites.toggle(current.id);
    btnFavCurrent.setAttribute("aria-pressed", String(added));
    showToast(added ? `Guardado en tus favoritos 💖` : `Eliminado de favoritos 🤍`);
  });

  let lastVolume = Number(volume.value);

  function updateVolumeUI() {
    const level = audio.muted ? 0 : audio.volume;
    volume.value = level;
    volume.style.setProperty("--vol", `${level * 100}%`);
    const silent = level === 0;
    iconVol.hidden = silent;
    iconMuted.hidden = !silent;
  }

  volume.addEventListener("input", () => {
    audio.muted = false;
    audio.volume = Number(volume.value);
    if (audio.volume > 0) lastVolume = audio.volume;
    window.Store.prefs.set("vol", audio.volume);
    updateVolumeUI();
  });

  btnMute.addEventListener("click", () => {
    if (audio.muted || audio.volume === 0) {
      audio.muted = false;
      audio.volume = lastVolume || 0.8;
    } else {
      audio.muted = true;
    }
    updateVolumeUI();
  });

  async function downloadPlaylistZip(playlistName, list, btnEl, labelEl) {
    if (downloadCtrl) {
      downloadCtrl.abort();
      return;
    }

    if (!list || !list.length) return;
    if (list.length === 1) {
      saveFile(list[0].src, fileNameFor(list[0]));
      return;
    }

    const folder = sanitize(playlistName);
    const pad = String(list.length).length;
    const files = [];
    const m3u = ["#EXTM3U"];
    let failed = 0;

    downloadCtrl = new AbortController();
    const { signal } = downloadCtrl;

    btnEl.classList.add("busy");
    btnEl.title = "Clic para cancelar la descarga";

    try {
      for (let i = 0; i < list.length; i++) {
        const song = list[i];
        labelEl.textContent = `Descargando ${i + 1}/${list.length}…`;

        try {
          const res = await fetch(song.src, { signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = new Uint8Array(await res.arrayBuffer());
          const name = `${String(i + 1).padStart(pad, "0")} - ${fileNameFor(song)}`;
          files.push({ name: `${folder}/${name}`, data });
          m3u.push(`#EXTINF:-1,${song.artist} - ${song.title}`, name);
        } catch (err) {
          if (signal.aborted) throw err;
          failed++;
          console.warn(`No se pudo descargar ${song.title}:`, err);
        }
      }

      if (!files.length) throw new Error("No se pudo descargar ninguna canción");

      labelEl.textContent = "Creando ZIP…";
      files.push({
        name: `${folder}/${folder}.m3u8`,
        data: new TextEncoder().encode(m3u.join("\r\n") + "\r\n"),
      });

      const url = URL.createObjectURL(window.MiniZip.createZip(files));
      saveFile(url, `${folder}.zip`);
      setTimeout(() => URL.revokeObjectURL(url), 30000);

      labelEl.textContent = failed ? `Listo (${failed} con error)` : "¡Completado!";
      showToast(`¡Descarga lista! Se guardó "${folder}.zip"`);
    } catch (err) {
      if (signal.aborted) {
        showToast("Descarga cancelada");
      } else {
        console.error("Error al crear ZIP:", err);
        showToast("Error al descargar canciones");
      }
    } finally {
      downloadCtrl = null;
      btnEl.classList.remove("busy");
      btnEl.title = "";
      setTimeout(() => {
        labelEl.textContent = "Descargar ZIP";
      }, 2500);
    }
  }

  function saveFile(href, name) {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") {
      if (e.key === "Escape") document.activeElement.blur();
      return;
    }

    if (e.code === "Space") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "/") {
      e.preventDefault();
      searchInput.focus();
    } else if (e.key.toLowerCase() === "s") {
      toggleShuffle();
    } else if (e.key.toLowerCase() === "r") {
      cycleRepeatMode();
    } else if (e.key.toLowerCase() === "m") {
      btnMute.click();
    } else if (e.key === "ArrowRight") {
      if (Number.isFinite(audio.duration)) audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
    } else if (e.key === "ArrowLeft") {
      if (Number.isFinite(audio.duration)) audio.currentTime = Math.max(0, audio.currentTime - 5);
    }
  });

  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", togglePlay);
    navigator.mediaSession.setActionHandler("pause", togglePlay);
    navigator.mediaSession.setActionHandler("previoustrack", playPrev);
    navigator.mediaSession.setActionHandler("nexttrack", playNext);
  }

  let searchTimeout = null;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const q = e.target.value.trim();
      if (q) {
        navigate(`#/buscar/${encodeURIComponent(q)}`);
      } else {
        navigate("#/");
      }
    }, 250);
  });

  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (q) navigate(`#/buscar/${encodeURIComponent(q)}`);
  });

  if (btnBack) btnBack.addEventListener("click", () => history.back());
  if (btnForward) btnForward.addEventListener("click", () => history.forward());

  window.addEventListener("hashchange", handleRoute);

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function init() {
    try {
      setupCookiesUI();
      const data = await window.DataSource.load();
      songs = data.songs;
      playlists = data.playlists;

      songs.forEach((s) => songMap.set(s.id, s));

      // Descubrir y armar playlists dinámicas por género
      buildGenrePlaylists();

      renderSidebarPlaylists();
      updateFavBadge();

      handleRoute();
    } catch (err) {
      console.error("Error al iniciar Mi Música:", err);
      viewContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Error al cargar las canciones</h3>
          <p>Revisa la conexión o consola para más detalles.</p>
        </div>
      `;
    }
  }

  init();
})();
