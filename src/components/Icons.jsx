/* Iconos SVG reutilizables (mismos trazos que la versión estática) */

const Svg = ({ size = 24, children, ...rest }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...rest}>
    {children}
  </svg>
);

const P = ({ d }) => <path fill="currentColor" d={d} />;

export const IconPlay = (p) => <Svg {...p}><P d="M8 5v14l11-7z" /></Svg>;
export const IconPause = (p) => <Svg {...p}><P d="M6 5h4v14H6zM14 5h4v14h-4z" /></Svg>;
export const IconHome = (p) => <Svg {...p}><P d="M12 3 3 10.5V21h6v-6h6v6h6V10.5z" /></Svg>;
export const IconSearch = (p) => <Svg {...p}><P d="M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3m0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10" /></Svg>;
export const IconHeartNav = (p) => <Svg {...p}><P d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2.3 4 6.3 4c2.3 0 3.8 1.3 4.7 2.6C11.9 5.3 13.4 4 15.7 4c4 0 5.9 4.4 4.3 7.7C19.5 16.4 12 21 12 21" /></Svg>;
export const IconBack = (p) => <Svg {...p}><P d="m15.4 7.4-1.4-1.4-6 6 6 6 1.4-1.4-4.6-4.6z" /></Svg>;
export const IconForward = (p) => <Svg {...p}><P d="m8.6 16.6 1.4 1.4 6-6-6-6-1.4 1.4 4.6 4.6z" /></Svg>;
export const IconPalette = (p) => <Svg {...p}><P d="M12 3a9 9 0 0 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8m-5.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3" /></Svg>;
export const IconCheck = (p) => <Svg {...p}><P d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" /></Svg>;
export const IconFade = (p) => <Svg {...p}><P d="M2 19 9 7v12zm13 0V7l7 12z" /></Svg>;
export const IconHeartOutline = (p) => <Svg {...p}><P d="M16.5 3c-1.7 0-3.4.8-4.5 2.1A6 6 0 0 0 7.5 3 5.4 5.4 0 0 0 2 8.5c0 3.8 3.4 6.9 8.6 11.5l1.4 1.3 1.4-1.3C18.6 15.4 22 12.3 22 8.5A5.4 5.4 0 0 0 16.5 3m-4.4 15.6-.1.1-.1-.1C7.1 14.2 4 11.4 4 8.5 4 6.5 5.5 5 7.5 5c1.5 0 3 1 3.6 2.4h1.9C13.5 6 15 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.9-3.1 5.7-7.9 10.1" /></Svg>;
export const IconHeartFill = (p) => <Svg {...p}><P d="m12 21.4-1.4-1.3C5.4 15.4 2 12.3 2 8.5A5.4 5.4 0 0 1 7.5 3c1.7 0 3.4.8 4.5 2.1A6 6 0 0 1 16.5 3 5.4 5.4 0 0 1 22 8.5c0 3.8-3.4 6.9-8.6 11.6z" /></Svg>;
export const IconShuffle = (p) => <Svg {...p}><P d="M10.6 9.2 5.4 4 4 5.4l5.2 5.2zM14.5 4l2 2L4 18.6 5.4 20 18 7.5l2 2V4zm.3 9.4-1.4 1.4 3.1 3.1-2 2H20v-5.5l-2 2z" /></Svg>;
export const IconPrev = (p) => <Svg {...p}><P d="M6 6h2v12H6zM9.5 12 18 18V6z" /></Svg>;
export const IconNext = (p) => <Svg {...p}><P d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" /></Svg>;
export const IconRepeat = (p) => <Svg {...p}><P d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z" /></Svg>;
export const IconRepeatOne = (p) => <Svg {...p}><P d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2zm-4-2V9h-1l-2 1v1h1.5v4z" /></Svg>;
export const IconVolume = (p) => <Svg {...p}><P d="M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4z" /></Svg>;
export const IconMuted = (p) => <Svg {...p}><P d="M3 9v6h4l5 5V4L7 9zm13.6 3 2.4-2.4-1.4-1.4-2.4 2.4-2.4-2.4-1.4 1.4 2.4 2.4-2.4 2.4 1.4 1.4 2.4-2.4 2.4 2.4 1.4-1.4z" /></Svg>;
export const IconDownload = (p) => <Svg {...p}><P d="M11 4h2v8.2l3.3-3.3 1.4 1.4L12 16l-5.7-5.7 1.4-1.4 3.3 3.3zM5 18h14v2H5z" /></Svg>;
export const IconNote = (p) => <Svg {...p}><P d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></Svg>;

