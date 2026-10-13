"""
Servidor local de desarrollo con soporte de HTTP Range.

`python -m http.server` no soporta Range, así que el navegador no puede
adelantar/atrasar el audio (vuelve al inicio). Este script sí lo hace.

Uso:  python server.py          (puerto 8000)
      python server.py 5500     (otro puerto)
"""
import os
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class RangeHandler(SimpleHTTPRequestHandler):
    _range_remaining = None

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-cache")  # ver cambios sin Ctrl+F5
        super().end_headers()

    def send_head(self):
        rng = self.headers.get("Range")
        path = self.translate_path(self.path)
        if not rng or os.path.isdir(path):
            return super().send_head()

        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404, "Archivo no encontrado")
            return None

        size = os.fstat(f.fileno()).st_size
        m = re.match(r"bytes=(\d*)-(\d*)$", rng.strip())
        if not m or (m.group(1) == "" and m.group(2) == ""):
            f.close()
            self.send_error(416)
            return None

        if m.group(1) == "":                     # bytes=-N (últimos N bytes)
            start = max(0, size - int(m.group(2)))
            end = size - 1
        else:
            start = int(m.group(1))
            end = int(m.group(2)) if m.group(2) else size - 1
        end = min(end, size - 1)

        if start >= size or start > end:
            f.close()
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return None

        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        f.seek(start)
        self._range_remaining = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        remaining = self._range_remaining
        self._range_remaining = None
        try:
            if remaining is None:
                return super().copyfile(source, outputfile)
            while remaining > 0:
                chunk = source.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                outputfile.write(chunk)
                remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass  # el navegador canceló la descarga al adelantar: normal


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f"Sirviendo en http://localhost:{port}  (Ctrl+C para detener)")
    ThreadingHTTPServer(("", port), RangeHandler).serve_forever()
