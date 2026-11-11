import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" → rutas relativas: funciona en GitHub Pages
// (usuario.github.io/Mi_musica/) sin tener que fijar el nombre del repo.
// El enrutado usa hash (#/...), así que no hace falta 404.html.
export default defineConfig({
  base: "./",
  plugins: [react()],
});

