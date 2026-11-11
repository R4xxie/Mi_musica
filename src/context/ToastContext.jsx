import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ToastContext = createContext({ showToast: () => {} });

export function ToastProvider({ children }) {
  const [message, setMessage] = useState("");
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const timers = useRef([]);

  const showToast = useCallback((msg) => {
    timers.current.forEach(clearTimeout);
    setMessage(msg);
    setMounted(true);
    // Un frame después para que la transición CSS de .show se aplique
    requestAnimationFrame(() => setVisible(true));
    timers.current = [
      setTimeout(() => {
        setVisible(false);
        timers.current.push(setTimeout(() => setMounted(false), 300));
      }, 2500),
    ];
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={`toast${visible ? " show" : ""}`} role="status" aria-live="polite" hidden={!mounted}>
        {message}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

