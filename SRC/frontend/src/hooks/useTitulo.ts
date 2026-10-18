import { useEffect } from "react";

/** Título de la pestaña por pantalla: ayuda a distinguir pestañas y a los lectores de pantalla al navegar. */
export function useTitulo(titulo: string) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · Cotiza+` : "Cotiza+";
  }, [titulo]);
}
