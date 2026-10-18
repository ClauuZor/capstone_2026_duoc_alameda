import { Link } from "react-router-dom";
import { EstadoVacio } from "../components/Estados";
import { useTitulo } from "../hooks/useTitulo";

export function NoEncontradaPage() {
  useTitulo("Página no encontrada");
  return (
    <EstadoVacio
      principal
      titulo="Esta página no existe"
      descripcion="Revisa la dirección o vuelve al resumen."
      accion={
        <Link to="/" className="font-medium text-vidrio hover:underline">
          Ir al resumen
        </Link>
      }
    />
  );
}
