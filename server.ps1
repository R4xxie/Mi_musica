# Servidor local robusto de alto rendimiento en PowerShell + C# (.NET Sockets)
# Compatible con cualquier versión de Windows (sin dependencias, sin admin, con HTTP Range)
# Uso: .\server.ps1        (puerto 8000)
#      .\server.ps1 5500   (otro puerto)

param([int]$Port = 8000)

$baseDir = $PSScriptRoot
if (-not $baseDir) { $baseDir = (Get-Location).Path }

$csharpCode = @"
using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Collections.Generic;

public class LocalServer {
    private static TcpListener _listener;
    private static string _baseDir;
    private static Dictionary<string, string> _mimeTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
        { ".html", "text/html; charset=utf-8" },
        { ".css", "text/css; charset=utf-8" },
        { ".js", "application/javascript; charset=utf-8" },
        { ".json", "application/json; charset=utf-8" },
        { ".mp3", "audio/mpeg" },
        { ".m4a", "audio/mp4" },
        { ".wav", "audio/wav" },
        { ".jpg", "image/jpeg" },
        { ".jpeg", "image/jpeg" },
        { ".png", "image/png" },
        { ".webp", "image/webp" },
        { ".svg", "image/svg+xml" }
    };

    public static void Start(string baseDir, int port) {
        _baseDir = baseDir;
        _listener = new TcpListener(IPAddress.Any, port);
        _listener.Start();
        Console.WriteLine("\n>>> Servidor iniciado en http://localhost:" + port + "/");
        Console.WriteLine(">>> También accesible en http://127.0.0.1:" + port + "/");
        Console.WriteLine(">>> Presiona Ctrl+C para detener el servidor.\n");

        while (true) {
            try {
                var client = _listener.AcceptTcpClient();
                ThreadPool.QueueUserWorkItem(HandleClient, client);
            } catch {
                break;
            }
        }
    }

    private static void HandleClient(object obj) {
        var client = (TcpClient)obj;
        try {
            using (var stream = client.GetStream())
            using (var reader = new StreamReader(stream, Encoding.ASCII)) {
                string requestLine = reader.ReadLine();
                if (string.IsNullOrEmpty(requestLine)) return;

                string[] parts = requestLine.Split(' ');
                if (parts.Length < 2) return;
                string url = parts[1];

                string rangeHeader = null;
                string line;
                while (!string.IsNullOrEmpty(line = reader.ReadLine())) {
                    if (line.StartsWith("Range:", StringComparison.OrdinalIgnoreCase)) {
                        rangeHeader = line.Substring(6).Trim();
                    }
                }

                string cleanUrl = Uri.UnescapeDataString(url.Split('?')[0].TrimStart('/'));
                if (string.IsNullOrWhiteSpace(cleanUrl)) cleanUrl = "index.html";

                string filePath = Path.Combine(_baseDir, cleanUrl.Replace('/', Path.DirectorySeparatorChar));
                if (!File.Exists(filePath)) {
                    byte[] notFound = Encoding.UTF8.GetBytes("404 No encontrado");
                    byte[] header = Encoding.ASCII.GetBytes("HTTP/1.1 404 Not Found\r\nContent-Length: " + notFound.Length + "\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\n");
                    stream.Write(header, 0, header.Length);
                    stream.Write(notFound, 0, notFound.Length);
                    return;
                }

                string ext = Path.GetExtension(filePath);
                string contentType = _mimeTypes.ContainsKey(ext) ? _mimeTypes[ext] : "application/octet-stream";

                using (var fileStream = File.OpenRead(filePath)) {
                    long fileSize = fileStream.Length;
                    long start = 0;
                    long end = fileSize - 1;
                    bool isRange = false;

                    if (!string.IsNullOrEmpty(rangeHeader)) {
                        var match = Regex.Match(rangeHeader, @"bytes=(\d*)-(\d*)");
                        if (match.Success) {
                            isRange = true;
                            if (!string.IsNullOrEmpty(match.Groups[1].Value))
                                start = long.Parse(match.Groups[1].Value);
                            if (!string.IsNullOrEmpty(match.Groups[2].Value))
                                end = long.Parse(match.Groups[2].Value);
                            else
                                end = fileSize - 1;

                            if (end >= fileSize) end = fileSize - 1;
                        }
                    }

                    if (isRange) {
                        if (start > end || start >= fileSize) {
                            byte[] h416 = Encoding.ASCII.GetBytes("HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */" + fileSize + "\r\nConnection: close\r\n\r\n");
                            stream.Write(h416, 0, h416.Length);
                            return;
                        }

                        long length = end - start + 1;
                        string resHeader = "HTTP/1.1 206 Partial Content\r\nContent-Type: " + contentType + "\r\nAccept-Ranges: bytes\r\nCache-Control: no-cache\r\nContent-Range: bytes " + start + "-" + end + "/" + fileSize + "\r\nContent-Length: " + length + "\r\nConnection: close\r\n\r\n";
                        byte[] hBytes = Encoding.ASCII.GetBytes(resHeader);
                        stream.Write(hBytes, 0, hBytes.Length);

                        fileStream.Seek(start, SeekOrigin.Begin);
                        byte[] buffer = new byte[65536];
                        long remaining = length;
                        while (remaining > 0) {
                            int toRead = (int)Math.Min(buffer.Length, remaining);
                            int read = fileStream.Read(buffer, 0, toRead);
                            if (read <= 0) break;
                            stream.Write(buffer, 0, read);
                            remaining -= read;
                        }
                    } else {
                        string resHeader = "HTTP/1.1 200 OK\r\nContent-Type: " + contentType + "\r\nAccept-Ranges: bytes\r\nCache-Control: no-cache\r\nContent-Length: " + fileSize + "\r\nConnection: close\r\n\r\n";
                        byte[] hBytes = Encoding.ASCII.GetBytes(resHeader);
                        stream.Write(hBytes, 0, hBytes.Length);
                        fileStream.CopyTo(stream);
                    }
                }
            }
        } catch {
            // Ignorar cancelaciones
        } finally {
            try { client.Close(); } catch {}
        }
    }
}
"@

if (-not ([System.Management.Automation.PSTypeName]'LocalServer').Type) {
    Add-Type -TypeDefinition $csharpCode
}

[LocalServer]::Start($baseDir, $Port)
