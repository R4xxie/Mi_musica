(() => {
  "use strict";

  /* ---------- Referencias al DOM ---------- */
  const grid        = document.getElementById("song-grid");
  const chips       = document.getElementById("playlist-chips");
  const sectionTitle= document.getElementById("section-title");
  const playerCover = document.getElementById("player-cover");
  const playerTitle = document.getElementById("player-title");
  const playerArtist= document.getElementById("player-artist");
  const btnPlay     = document.getElementById("btn-play");
  const btnPrev     = document.getElementById("btn-prev");
  const btnNext     = document.getElementById("btn-next");
  const iconPlay    = document.getElementById("icon-play");
  const iconPause   = document.getElementById("icon-pause");
  const progress    = document.getElementById("progress");
  const progressFill  = document.getElementById("progress-fill");
  const progressThumb = document.getElementById("progress-thumb");
  const timeCurrent = document.getElementById("time-current");
  const timeTotal   = document.getElementById("time-total");
  const volume      = document.getElementById("volume");
  const btnMute     = document.getElementById("btn-mute");
  const iconVol     = document.getElementById("icon-vol");
  const iconMuted   = document.getElementById("icon-muted");
  const btnDownload = document.getElementById("btn-download");
  const downloadLabel = document.getElementById("download-label");

  /* ---------- Estado ---------- */
  const audio = new Audio();           // único elemento <audio>
  audio.preload = "metadata";

  const ALL = "__all__";                       // vista "Todas"
  const STORAGE_KEY = "mi-musica:playlist";    // última playlist abierta

  let songs = [];        // catálogo completo
  let playlists = [];    // [{ name, songs: [objetos canción] }]
  let activeView = ALL;  // playlist mostrada en pantalla
  let viewSongs = [];    // canciones visibles en la cuadrícula
  let queue = [];        // cola de reproducción (playlist desde la que se dio play)
  let queueIndex = -1;
  let isDragging = false;

  const currentSong = () => queue[queueIndex] || null;
  let consecutiveErrors = 0;           // pistas fallidas seguidas

  // Carátula de respaldo (SVG inline) cuando una imagen no carga
  const FALLBACK_COVER = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<rect width="100" height="100" fill="#272727"/>' +
    '<path fill="#666" d="M42 28v32.5a9 9 0 1 0 6 8.5V42h14V28z"/></svg>'
  );

  /* ---------- Utilidades ---------- */
  const formatTime = (s) => {
    if (!Number.isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  // Sustituye la imagen por el respaldo si falla (sin bucles)
  function setCover(img, src) {
    img.onerror = () => {
      img.onerror = null;
      img.src = FALLBACK_COVER;
    };
    img.src = src || FALLBACK_COVER;
  }

  // Nombre de archivo válido en Windows/macOS/Linux
  const sanitize = (s) =>
    String(s).replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "sin-nombre";

  const extOf = (src) => {
    const m = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(src || "");
    return m ? m[1].toLowerCase() : "mp3";
  };

  const fileNameFor = (song) => `${sanitize(`${song.artist} - ${song.title}`)}.${extOf(song.src)}`;

  /* ---------- Carga de datos ---------- */
  async function loadLibrary() {
    try {
      const res = await fetch("data/db.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      parseLibrary(await res.json());
      renderChips();
      selectView(restoreView());
    } catch (err) {
      console.error("No se pudo cargar db.json:", err);
      grid.innerHTML = `<p class="status">No se pudieron cargar las canciones.</p>`;
    }
  }

  // Acepta el formato antiguo (array) y el nuevo ({ songs, playlists })
  function parseLibrary(data) {
    songs = Array.isArray(data) ? data : data.songs || [];

    const byId = new Map();
    songs.forEach((song) => {
      if (byId.has(song.id)) console.warn(`db.json: id duplicado ${song.id}`);
      byId.set(song.id, song);
    });

    const rawPlaylists = Array.isArray(data) ? [] : data.playlists || [];
    playlists = rawPlaylists.map((pl) => ({
      name: String(pl.name || "Sin nombre"),
      songs: (pl.songs || [])
        .map((id) => {
          const song = byId.get(id);
          if (!song) console.warn(`db.json: la playlist "${pl.name}" usa un id inexistente: ${id}`);
          return song;
        })
        .filter(Boolean),
    }));
  }

  /* ---------- Playlists (filtros) ---------- */
  function getView(key) {
    if (key === ALL) return { name: "Todas las canciones", songs };
    return playlists.find((pl) => pl.name === key) || null;
  }

  function restoreView() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && getView(saved)) return saved;
    } catch { /* localStorage no disponible */ }
    return ALL;
  }

  function selectView(key) {
    if (!getView(key)) key = ALL;
    activeView = key;
    const view = getView(key);
    viewSongs = view.songs;
    sectionTitle.textContent = view.name;

    try { localStorage.setItem(STORAGE_KEY, key); } catch { /* ignorar */ }

    chips.querySelectorAll(".chip").forEach((chip) => {
      chip.setAttribute("aria-pressed", String(chip.dataset.view === activeView));
    });
    if (!downloadCtrl) btnDownload.hidden = !viewSongs.length;
    renderCards();
  }

  function renderChips() {
    if (!playlists.length) {
      chips.hidden = true;
      return;
    }
    const fragment = document.createDocumentFragment();
    [ALL, ...playlists.map((pl) => pl.name)].forEach((key) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.dataset.view = key;
      chip.textContent = key === ALL ? "Todas" : key;
      chip.addEventListener("click", () => selectView(key));
      fragment.appendChild(chip);
    });
    chips.replaceChildren(fragment);
    chips.hidden = false;
  }

  /* ---------- Render de tarjetas ---------- */
  function renderCards() {
    if (!viewSongs.length) {
      const msg = songs.length ? "Esta playlist está vacía." : "No hay canciones disponibles.";
      grid.innerHTML = `<p class="status">${msg}</p>`;
      return;
    }

    const fragment = document.createDocumentFragment();

    viewSongs.forEach((song, index) => {
      const card = document.createElement("div");
      card.className = "card";
      card.dataset.index = index;

      card.innerHTML = `
        <button class="card-hit" type="button">
          <div class="card-cover-wrap">
            <img class="card-cover" loading="lazy" alt="" />
            <div class="card-overlay">
              <span class="card-play">
                <svg viewBox="0 0 24 24" width="26" height="26"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
              </span>
            </div>
          </div>
          <p class="card-title"></p>
          <p class="card-artist"></p>
        </button>
        <a class="card-download" title="Descargar">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M11 4h2v8.2l3.3-3.3 1.4 1.4L12 16l-5.7-5.7 1.4-1.4 3.3 3.3zM5 18h14v2H5z"/></svg>
        </a>
      `;

      const hit = card.querySelector(".card-hit");
      hit.setAttribute("aria-label", `Reproducir ${song.title} de ${song.artist}`);

      // textContent evita inyección de HTML desde el JSON
      setCover(card.querySelector(".card-cover"), song.cover);
      card.querySelector(".card-title").textContent = song.title;
      card.querySelector(".card-artist").textContent = song.artist;

      // Descarga individual: el atributo download fija el nombre del archivo
      const link = card.querySelector(".card-download");
      link.href = song.src;
      link.download = fileNameFor(song);
      link.setAttribute("aria-label", `Descargar ${song.title}`);

      hit.addEventListener("click", () => playFromView(index));
      fragment.appendChild(card);
    });

    grid.innerHTML = "";
    grid.appendChild(fragment);
    highlightActiveCard();
  }

  /* ---------- Reproducción ---------- */
  // Clic en una tarjeta: la playlist visible pasa a ser la cola
  function playFromView(index) {
    const song = viewSongs[index];
    if (!song) return;

    // Clic en la canción actual: alternar play/pause
    if (song === currentSong()) {
      togglePlay();
      return;
    }

    queue = viewSongs.slice();
    playAt(index);
  }

  // Reproduce la posición indicada de la cola
  function playAt(index) {
    if (index < 0 || index >= queue.length) return;
    queueIndex = index;
    const song = queue[index];

    audio.src = song.src;
    audio.play().catch((err) => console.warn("Reproducción bloqueada o fallida:", err));

    updatePlayerInfo(song);
    highlightActiveCard();
    resetProgress();
  }

  function togglePlay() {
    if (!currentSong()) {
      if (viewSongs.length) playFromView(0);
      return;
    }
    if (audio.paused) {
      audio.play().catch((err) => console.warn(err));
    } else {
      audio.pause();
    }
  }

  function playNext() {
    if (!queue.length) {
      if (viewSongs.length) playFromView(0);
      return;
    }
    // Al llegar al final, vuelve a la primera canción de la cola
    playAt((queueIndex + 1) % queue.length);
  }

  function playPrev() {
    if (!queue.length) return;
    // Si ya pasaron más de 3 s, reinicia la pista actual (como YT Music)
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    playAt(queueIndex <= 0 ? queue.length - 1 : queueIndex - 1);
  }

  /* ---------- Actualización de UI ---------- */
  function updatePlayerInfo(song) {
    playerTitle.textContent = song.title;
    playerArtist.textContent = song.artist;
    setCover(playerCover, song.cover);
    playerCover.alt = `Carátula de ${song.title}`;
    playerCover.hidden = false;
    document.title = `${song.title} • ${song.artist}`;
  }

  // Marca la canción que suena, aunque se esté viendo otra playlist
  function highlightActiveCard() {
    const current = currentSong();
    grid.querySelectorAll(".card").forEach((card) => {
      card.classList.toggle("active", !!current && viewSongs[card.dataset.index] === current);
    });
  }

  function setPlayingUI(playing) {
    iconPlay.hidden = playing;
    iconPause.hidden = !playing;
    btnPlay.setAttribute("aria-label", playing ? "Pausar" : "Reproducir");
  }

  function resetProgress() {
    setProgressUI(0);
    timeCurrent.textContent = "0:00";
    timeTotal.textContent = "0:00";
  }

  function setProgressUI(percent) {
    const p = Math.min(100, Math.max(0, percent));
    progressFill.style.width = `${p}%`;
    progressThumb.style.left = `${p}%`;
    progress.setAttribute("aria-valuenow", Math.round(p));
  }

  /* ---------- Barra de progreso interactiva ---------- */
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
    isDragging = true;
    progress.classList.add("dragging");
    progress.setPointerCapture(e.pointerId);
    seekFromEvent(e);
  });

  progress.addEventListener("pointermove", (e) => {
    if (isDragging) seekFromEvent(e);
  });

  progress.addEventListener("pointerup", (e) => {
    if (!isDragging) return;
    isDragging = false;
    progress.classList.remove("dragging");
    const ratio = seekFromEvent(e);
    if (ratio !== undefined) audio.currentTime = ratio * audio.duration;
  });

  progress.addEventListener("pointercancel", () => {
    isDragging = false;
    progress.classList.remove("dragging");
  });

  // Accesibilidad: flechas del teclado para adelantar/atrasar 5 s
  progress.addEventListener("keydown", (e) => {
    if (!Number.isFinite(audio.duration)) return;
    if (e.key === "ArrowRight") audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
    if (e.key === "ArrowLeft")  audio.currentTime = Math.max(0, audio.currentTime - 5);
  });

  /* ---------- Eventos del <audio> ---------- */
  audio.addEventListener("play",  () => setPlayingUI(true));
  audio.addEventListener("pause", () => setPlayingUI(false));
  // Una pista sonó bien: reinicia el contador de errores
  audio.addEventListener("playing", () => { consecutiveErrors = 0; });

  audio.addEventListener("loadedmetadata", () => {
    timeTotal.textContent = formatTime(audio.duration);
  });

  audio.addEventListener("timeupdate", () => {
    if (isDragging || !Number.isFinite(audio.duration)) return;
    setProgressUI((audio.currentTime / audio.duration) * 100);
    timeCurrent.textContent = formatTime(audio.currentTime);
  });

  audio.addEventListener("ended", playNext);

  audio.addEventListener("error", () => {
    console.error("Error al cargar el audio:", audio.src);
    consecutiveErrors++;
    setPlayingUI(false);

    // Salta a la siguiente solo si aún quedan pistas sin probar;
    // si todas fallaron, se detiene (evita el bucle infinito)
    if (consecutiveErrors < queue.length) {
      playNext();
    } else {
      consecutiveErrors = 0;
      playerArtist.textContent = "No se pudo reproducir el audio";
    }
  });

  /* ---------- Controles ---------- */
  btnPlay.addEventListener("click", togglePlay);
  btnNext.addEventListener("click", playNext);
  btnPrev.addEventListener("click", playPrev);

  /* ---------- Descarga de la playlist ---------- */
  let downloadCtrl = null;   // AbortController de la descarga en curso
  let labelTimer = null;

  function setDownloadLabel(text, busy) {
    clearTimeout(labelTimer);
    downloadLabel.textContent = text;
    btnDownload.classList.toggle("busy", busy);
    btnDownload.setAttribute("aria-busy", String(busy));
    btnDownload.title = busy ? "Clic para cancelar" : "";
  }

  // Muestra un mensaje breve y vuelve al texto normal
  function flashDownloadLabel(text) {
    setDownloadLabel(text, false);
    labelTimer = setTimeout(() => {
      downloadLabel.textContent = "Descargar";
      btnDownload.hidden = !viewSongs.length;
    }, 2500);
  }

  function saveFile(href, name) {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function downloadView() {
    // Segundo clic durante la descarga: cancelar
    if (downloadCtrl) {
      downloadCtrl.abort();
      return;
    }

    const list = viewSongs.slice();
    if (!list.length) return;

    // Una sola canción: descarga directa, sin ZIP
    if (list.length === 1) {
      saveFile(list[0].src, fileNameFor(list[0]));
      return;
    }

    const folder = sanitize(getView(activeView).name);
    const pad = String(list.length).length;
    const files = [];
    const m3u = ["#EXTM3U"];
    let failed = 0;

    downloadCtrl = new AbortController();
    const { signal } = downloadCtrl;

    try {
      for (let i = 0; i < list.length; i++) {
        const song = list[i];
        setDownloadLabel(`Descargando ${i + 1}/${list.length}…`, true);
        try {
          const res = await fetch(song.src, { signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = new Uint8Array(await res.arrayBuffer());
          // Prefijo numérico: conserva el orden y evita nombres duplicados
          const name = `${String(i + 1).padStart(pad, "0")} - ${fileNameFor(song)}`;
          files.push({ name: `${folder}/${name}`, data });
          m3u.push(`#EXTINF:-1,${song.artist} - ${song.title}`, name);
        } catch (err) {
          if (signal.aborted) throw err;
          failed++;
          console.warn(`No se pudo descargar "${song.title}":`, err);
        }
      }

      if (!files.length) throw new Error("Ninguna canción se pudo descargar");

      setDownloadLabel("Creando ZIP…", true);
      files.push({
        name: `${folder}/${folder}.m3u8`,
        data: new TextEncoder().encode(m3u.join("\r\n") + "\r\n"),
      });

      const url = URL.createObjectURL(window.MiniZip.createZip(files));
      saveFile(url, `${folder}.zip`);
      setTimeout(() => URL.revokeObjectURL(url), 30000);

      flashDownloadLabel(failed ? `Listo (${failed} con error)` : "¡Listo!");
    } catch (err) {
      if (!signal.aborted) console.error("Error al descargar la playlist:", err);
      flashDownloadLabel(signal.aborted ? "Cancelado" : "Error al descargar");
    } finally {
      downloadCtrl = null;
    }
  }

  btnDownload.addEventListener("click", downloadView);

  /* ---------- Volumen ---------- */
  let lastVolume = Number(volume.value);

  function updateVolumeUI() {
    // Nivel visible: 0 si está silenciado, para que barra y control coincidan
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

  /* ---------- Atajo de teclado: espacio = play/pause ---------- */
  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement.tagName;
    if (e.code === "Space" && tag !== "INPUT" && tag !== "BUTTON") {
      e.preventDefault();
      togglePlay();
    }
  });

  /* ---------- Inicio ---------- */
  audio.volume = Number(volume.value);
  updateVolumeUI();
  loadLibrary();
})();
