/*
 * Generador mínimo de archivos ZIP (sin compresión, método "store").
 * Los MP3 ya están comprimidos, así que comprimirlos otra vez no ahorra
 * espacio y solo gastaría CPU. Sin librerías externas.
 *
 * Uso: MiniZip.createZip([{ name: "carpeta/archivo.mp3", data: Uint8Array }]) → Blob
 */
(() => {
  "use strict";

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // Fecha/hora en formato MS-DOS (el que usa ZIP)
  function dosDateTime(d) {
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
      date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
  }

  const UTF8_FLAG = 0x0800;   // nombres de archivo en UTF-8 (tildes, ñ…)
  const MAX_U32 = 0xffffffff; // límite de ZIP clásico (sin ZIP64): 4 GB

  function createZip(files) {
    const encoder = new TextEncoder();
    const { time, date } = dosDateTime(new Date());
    const body = [];
    const central = [];
    let offset = 0;
    let centralSize = 0;

    for (const file of files) {
      const name = encoder.encode(file.name);
      const data = file.data;
      const size = data.length;
      const crc = crc32(data);

      if (offset + 30 + name.length + size > MAX_U32) {
        throw new Error("El ZIP superaría 4 GB");
      }

      // Cabecera local
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);          // versión necesaria
      local.setUint16(6, UTF8_FLAG, true);
      local.setUint16(8, 0, true);           // método: store
      local.setUint16(10, time, true);
      local.setUint16(12, date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, size, true);       // tamaño comprimido
      local.setUint32(22, size, true);       // tamaño original
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);          // campo extra
      body.push(local.buffer, name, data);

      // Entrada del directorio central
      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);             // versión creadora
      cd.setUint16(6, 20, true);             // versión necesaria
      cd.setUint16(8, UTF8_FLAG, true);
      cd.setUint16(10, 0, true);
      cd.setUint16(12, time, true);
      cd.setUint16(14, date, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, size, true);
      cd.setUint32(24, size, true);
      cd.setUint16(28, name.length, true);
      cd.setUint16(30, 0, true);             // extra
      cd.setUint16(32, 0, true);             // comentario
      cd.setUint16(34, 0, true);             // disco
      cd.setUint16(36, 0, true);             // atributos internos
      cd.setUint32(38, 0, true);             // atributos externos
      cd.setUint32(42, offset, true);        // posición de la cabecera local
      central.push(cd.buffer, name);

      offset += 30 + name.length + size;
      centralSize += 46 + name.length;
    }

    // Fin del directorio central
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);

    return new Blob([...body, ...central, end.buffer], { type: "application/zip" });
  }

  window.MiniZip = { createZip };
})();
