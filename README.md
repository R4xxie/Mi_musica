<<<<<<< Updated upstream
**Reproductor de música web moderno, ultrarrápido y responsivo con estética inspirada en plataformas de streaming.**  
Construido 100% con Vanilla JavaScript, HTML5 y CSS3, sin frameworks pesados ni dependencias innecesarias.

=======
# 🎵 Mi Música

<div align="center">

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Responsive](https://img.shields.io/badge/Design-Responsive-blueviolet?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)

**Reproductor de música web moderno, ultrarrápido y responsivo con estética inspirada en plataformas de streaming.**  
Construido 100% con Vanilla JavaScript, HTML5 y CSS3, sin frameworks pesados ni dependencias innecesarias.

>>>>>>> Stashed changes
</div>

---

## 📖 Descripción

**Mi Música** es una aplicación web estática de reproducción de audio diseñada para ofrecer una experiencia fluida, elegante y sin interrupciones tanto en dispositivos móviles como en ordenadores de escritorio.

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

### 🔍 Búsqueda y Descargas
- **Buscador en Tiempo Real**: Filtra instantáneamente por nombre de canción, artista o género con atajos de teclado rápidos.
- **Descargas Individuales**: Guarda cualquier pista directamente en formato MP3.
- **Empaquetado en Lote (ZIP + M3U8)**: Descarga listas completas generadas al vuelo en el navegador en un archivo `.zip` comprimido junto con su archivo de lista de reproducción `.m3u8`.

---

## ⌨️ Atajos de Teclado

Para facilitar el control de la reproducción en ordenadores, la aplicación incluye atajos globales:

| Tecla | Acción |
| :--- | :--- |
| <kbd>Espacio</kbd> | Reproducir / Pausar |
| <kbd>/</kbd> | Enfocar la barra de búsqueda |
| <kbd>S</kbd> | Activar / Desactivar modo aleatorio (*Shuffle*) |
| <kbd>R</kbd> | Alternar modo de repetición (*Off / All / One*) |
| <kbd>M</kbd> | Silenciar / Restaurar volumen (*Mute*) |
| <kbd>→</kbd> | Adelantar 5 segundos |
| <kbd>←</kbd> | Retroceder 5 segundos |
| <kbd>Esc</kbd> | Desenfocar el campo de búsqueda |

---

## 📁 Estructura del Proyecto

```text
reproductor-musica/
├── css/
│   └── styles.css          # Estilos globales, variables CSS, layout y diseño responsivo
├── data/
│   └── db.json             # Catálogo de canciones y metadatos
├── img/                    # Recursos visuales y carátulas
├── js/
│   ├── app.js              # Controlador principal, reproductor de audio y router SPA
│   ├── data.js             # Capa desacoplada de origen de datos
│   ├── storage.js          # Gestión de preferencias, favoritos e historial del usuario
│   └── zip.js              # Generación de descargas ZIP y listas M3U8 en cliente
├── index.html              # Estructura semántica principal de la aplicación
└── README.md               # Documentación del proyecto
```

---

## 🛠️ Tecnologías Utilizadas

- **HTML5**: Estructura semántica y elemento `<audio>`.
- **CSS3**: Variables nativas, Flexbox, CSS Grid, Glassmorphism y animaciones aceleradas por hardware.
- **JavaScript (ES6+)**: Lógica reactiva modular sin transpiladores ni frameworks.
- **MediaSession API**: Integración con el sistema operativo y controles multimedia de dispositivos.
- **JSZip**: Biblioteca cliente para compresión y generación de archivos `.zip`.
- **Google Fonts (Outfit)**: Tipografía moderna y optimizada.

---

## 🤝 Contribuciones

Las contribuciones, reportes de errores y sugerencias son bienvenidos:

1. Haz un **Fork** del proyecto.
2. Crea una rama para tu funcionalidad (`git checkout -b feature/NuevaCaracteristica`).
3. Realiza los cambios necesarios y haz commit (`git commit -m 'feat: Agregar nueva funcionalidad'`).
4. Sube tu rama (`git push origin feature/NuevaCaracteristica`).
5. Abre un **Pull Request**.

---

## 📄 Licencia

<<<<<<< Updated upstream
Este proyecto se distribuye bajo la licencia MIT. Siéntete libre de utilizarlo, modificarlo y compartirlo.
=======
Este proyecto se distribuye bajo la licencia MIT. Siéntete libre de utilizarlo, modificarlo y compartirlo.
>>>>>>> Stashed changes
