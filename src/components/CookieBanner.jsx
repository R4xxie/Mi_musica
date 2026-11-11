import { useState } from "react";
import Store from "../lib/storage.js";

export default function CookieBanner() {
  const [visible, setVisible] = useState(() => !Store.consent.seen());

  return (
    <div className="cookie-banner" id="cookie-banner" role="dialog" aria-live="polite" aria-label="Aviso de cookies" hidden={!visible}>
      <span className="cookie-emoji" aria-hidden="true">🍪</span>
      <p>
        Usamos cookies propias para recordar <strong>tus favoritos</strong>, lo último que escuchaste
        y tus preferencias en este navegador. No se comparten con nadie.
      </p>
      <button
        className="btn btn-primary"
        id="cookie-accept"
        type="button"
        onClick={() => {
          Store.consent.accept();
          setVisible(false);
        }}
      >
        Entendido
      </button>
    </div>
  );
}

