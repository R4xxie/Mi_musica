# 🎵 Mi Música

<div align="center">

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Responsive](https://img.shields.io/badge/Design-Responsive-blueviolet?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)

**Reproductor de música web moderno, ultrarrápido y responsivo con estética inspirada en plataformas de streaming.**  
Construido con React + Vite y desplegado automáticamente en GitHub Pages mediante GitHub Actions.

</div>

---

## 📖 Descripción

**Mi Música** es una aplicación web (SPA en React) de reproducción de audio diseñada para ofrecer una experiencia fluida, elegante y sin interrupciones tanto en dispositivos móviles como en ordenadores de escritorio.

Incorpora un sistema de navegación por rutas basado en Hash (SPA), persistencia de preferencias por usuario en el navegador, descargas individuales y en lote (.zip con lista .m3u8), y soporte nativo con la API MediaSession para integración con pantallas de bloqueo y teclas multimedia.

---

## ✨ Características Principales

### 🎨 Diseño y Experiencia de Usuario
- **Estética Moderna & Dark Theme**: Interfaz limpia inspirada en YouTube Music con paleta de colores oscuros, sombras dinámicas y microinteracciones suaves.
- **Totalmente Responsivo**: Barra lateral ergonómica en pantallas grandes y barra de navegación inferior optimizada para móviles.
- **Enrutamiento SPA**: Navegación fluida sin recargas de página (`#/`, `#/buscar`, `#/playlist/:id`, `#/playlist/favoritos`).

### 🎧 Reproductor de Audio Avanzado
- **Controles Completos**: Barra de progreso con arrastre táctil interactivo, control de volumen y estado de buffer.
- **Modo Aleatorio (Shuffle)**: Mezcla inteligente de la cola de reproducción sin interrumpir la pista actual.
- **Modos de Repetición (Repeat)**: Ciclo entre apagado, repetir toda la lista o repetir la canción actual en bucle.
- **MediaSession API**: Muestra el título, artista, álbum y carátula en la pantalla de bloqueo de Android/iOS y en teclados o auriculares con controles multimedia.

### 💖 Colección Personal y Preferencias
- **Favoritos Dinámicos**: Marca canciones con un clic y accede a tu lista personalizada en tiempo real.
- **Historial Reciente**: Registro de las últimas canciones escuchadas.
- **Persistencia**: Recuerda volumen, estado de mute, modo aleatorio y modo de repetición para cada visitante.

## 📄 Licencia

Este proyecto se distribuye bajo la licencia MIT. Siéntete libre de utilizarlo, modificarlo y compartirlo.
