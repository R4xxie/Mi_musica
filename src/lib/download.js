import { createZip } from "./zip.js";
import { fileNameFor, sanitize, saveFile } from "./utils.js";

/*
 * Descarga de playlists completas en un ZIP (+ lista .m3u8).
 * El controlador vive a nivel de módulo: la descarga continúa aunque
 * cambies de vista, y un segundo clic la cancela.
 */
let downloadCtrl = null;

export const isDownloading = () => downloadCtrl !== null;
export const cancelDownload = () => downloadCtrl?.abort();

/**
 * @param {string} playlistName
 * @param {Array} list canciones
 * @param {(label: string) => void} onProgress
 * @returns {Promise<{ ok: boolean, cancelled?: boolean, failed?: number, fileName?: string }>}
 */
export async function downloadPlaylistZip(playlistName, list, onProgress = () => {}) {
  if (!list || !list.length) return { ok: false };
  if (list.length === 1) {
    saveFile(list[0].src, fileNameFor(list[0]));
    return { ok: true, single: true };
  }

  const folder = sanitize(playlistName);
  const pad = String(list.length).length;
  const files = [];
  const m3u = ["#EXTM3U"];
  let failed = 0;

  downloadCtrl = new AbortController();
  const { signal } = downloadCtrl;

  try {
    for (let i = 0; i < list.length; i++) {
      const song = list[i];
      onProgress(`Descargando ${i + 1}/${list.length}…`);

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

    onProgress("Creando ZIP…");
    files.push({
      name: `${folder}/${folder}.m3u8`,
      data: new TextEncoder().encode(m3u.join("\r\n") + "\r\n"),
    });

    const url = URL.createObjectURL(createZip(files));
    saveFile(url, `${folder}.zip`);
    setTimeout(() => URL.revokeObjectURL(url), 30000);

    return { ok: true, failed, fileName: `${folder}.zip` };
  } catch (err) {
    if (signal.aborted) return { ok: false, cancelled: true };
    console.error("Error al crear ZIP:", err);
    return { ok: false };
  } finally {
    downloadCtrl = null;
  }
}

