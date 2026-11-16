import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { ApiError } from "../api/errors";
import type { EstadoDocumento, ProgresoIngesta } from "../api/types";
import { Campo, Encabezado, Entrada, Selector } from "../components/Controles";
import { EstadoCarga, EstadoError, EstadoVacio } from "../components/Estados";
import { Paginacion } from "../components/Paginacion";
import { useDocumentos, useEstadoDrive, useProgresoIngesta } from "../hooks/consultas";
import { useTitulo } from "../hooks/useTitulo";
import { formatFechaHora, formatNumero, plural } from "../lib/format";

const TAMANO_PAGINA = 20;

/** Motivos que devuelve el backend en /drive?drive=error&motivo=… al volver de Google. */
const MOTIVOS: Record<string, string> = {
  invalido: "La solicitud de conexión no es válida o ya fue usada. Inténtalo de nuevo.",
  vencido: "La solicitud de conexión venció (15 minutos). Inténtalo de nuevo.",
  cancelado: "No se otorgó acceso a Google Drive.",
  rechazado: "Google rechazó la autorización. Inténtalo de nuevo.",
  sin_refresh: "Google no entregó un permiso permanente. Quita el acceso de Cotiza+ en tu cuenta de Google y vuelve a conectar.",
  no_configurado: "El servidor no tiene Google configurado.",
};

const ESTADOS: Record<EstadoDocumento, { texto: string; clase: string }> = {
  procesado: { texto: "Procesado", clase: "bg-vidrio-tenue text-vidrio-fuerte" },
  duplicado: { texto: "Duplicado", clase: "bg-alerta-tenue text-alerta" },
  error: { texto: "Error", clase: "bg-error-tenue text-error" },
  pendiente: { texto: "Pendiente", clase: "bg-hundido text-texto-suave" },
};

const mensaje = (e: unknown) => (e instanceof ApiError ? e.message : "Ocurrió un error inesperado.");

const boton = "rounded-md px-4 py-2 font-semibold disabled:opacity-60";
const botonPrincipal = `${boton} bg-vidrio text-white hover:bg-vidrio-fuerte dark:text-fondo`;
const botonSecundario = `${boton} border border-borde-fuerte bg-superficie hover:bg-hundido`;

function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="rounded-lg border border-borde bg-superficie p-5">
      <h2 className="mb-3 text-lg font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

function Aviso({ tipo, children }: { tipo: "ok" | "error"; children: ReactNode }) {
  const clase = tipo === "ok" ? "border-vidrio/40 bg-vidrio-tenue" : "border-error/40 bg-error-tenue";
  return (
    <div role={tipo === "ok" ? "status" : "alert"} className={`mb-6 rounded-md border px-5 py-3 ${clase}`}>
      {children}
    </div>
  );
}

function minutosRestantes(p: ProgresoIngesta): string | null {
  if (!p.inicio || p.revisados < 10 || p.total <= p.revisados) return null;
  const segundos = (Date.now() - new Date(p.inicio).getTime()) / 1000;
  const restante = ((p.total - p.revisados) * segundos) / p.revisados;
  return restante < 60 ? "menos de 1 minuto" : `unos ${Math.ceil(restante / 60)} min`;
}

function Contadores({ p }: { p: ProgresoIngesta }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      <dt className="text-texto-suave">Nuevas cotizaciones</dt>
      <dd className="text-right font-medium tabular-nums text-vidrio-fuerte">{formatNumero(p.procesados)}</dd>
      <dt className="text-texto-suave">Duplicados</dt>
      <dd className="text-right font-medium tabular-nums">{formatNumero(p.duplicados)}</dd>
      <dt className="text-texto-suave">Con error</dt>
      <dd className={`text-right font-medium tabular-nums ${p.errores ? "text-error" : ""}`}>{formatNumero(p.errores)}</dd>
      <dt className="text-texto-suave">Ya revisados antes</dt>
      <dd className="text-right font-medium tabular-nums">{formatNumero(p.omitidos)}</dd>
    </dl>
  );
}

function AvanceSincronizacion({ p, cancelando, alCancelar }: { p: ProgresoIngesta; cancelando: boolean; alCancelar: () => void }) {
  const listando = p.encontrados === 0 && p.revisados === 0;
  const porcentaje = p.total ? Math.round((p.revisados / p.total) * 100) : 0;
  const restante = minutosRestantes(p);
  return (
    <div className="mt-3" aria-label="Avance de la sincronización">
      {listando ? (
        <p role="status" className="flex items-center gap-2 text-sm">
          <span className="size-4 animate-spin rounded-full border-2 border-borde-fuerte border-t-vidrio" aria-hidden />
          Revisando la carpeta en Drive…
        </p>
      ) : (
        <>
          <div className="flex justify-between text-sm">
            <span className="font-medium">
              {formatNumero(p.revisados)} de {formatNumero(p.total)} PDF
            </span>
            <span className="text-texto-suave tabular-nums">{porcentaje}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-hundido" role="progressbar" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.revisados}>
            <div className="h-full rounded-full bg-vidrio transition-[width] duration-500" style={{ width: `${porcentaje}%` }} />
          </div>
          {restante && <p className="mt-1 text-sm text-texto-suave">Quedan {restante}. Puedes seguir usando Cotiza+ mientras tanto.</p>}
          <Contadores p={p} />
        </>
      )}
      <button type="button" className={`${botonSecundario} mt-3`} disabled={cancelando} onClick={alCancelar}>
        {cancelando ? "Cancelando…" : "Cancelar"}
      </button>
    </div>
  );
}

const TITULOS_RESULTADO: Record<string, string> = {
  terminado: "Última sincronización",
  cancelado: "Sincronización cancelada",
  fallido: "La sincronización falló",
};

function ResultadoSincronizacion({ p }: { p: ProgresoIngesta }) {
  return (
    <div className="mt-4 border-t border-borde pt-3" aria-label="Resultado de la sincronización">
      <p className={`text-sm font-semibold ${p.estado === "fallido" ? "text-error" : ""}`}>{TITULOS_RESULTADO[p.estado]}</p>
      {p.mensaje && <p className="mt-0.5 text-sm">{p.mensaje}</p>}
      {p.fin && <p className="text-sm text-texto-suave">{formatFechaHora(p.fin)}</p>}
      {p.estado !== "fallido" && (
        <>
          <p className="mt-1 text-sm text-texto-suave">{formatNumero(p.encontrados)} PDF en la carpeta.</p>
          <Contadores p={p} />
        </>
      )}
    </div>
  );
}

export function DrivePage() {
  useTitulo("Google Drive");
  const [params, setParams] = useSearchParams();
  const navegar = useNavigate();
  const queryClient = useQueryClient();
  const estado = useEstadoDrive();

  const resultadoRetorno = params.get("drive");
  const motivoRetorno = params.get("motivo");
  const filtroEstado = (params.get("estado") || undefined) as EstadoDocumento | undefined;
  const pagina = Math.max(1, Number(params.get("page")) || 1);
  const progreso = useProgresoIngesta();
  const enCurso = progreso.data?.estado === "en_curso";
  const documentos = useDocumentos({ estado: filtroEstado, page: pagina, page_size: TAMANO_PAGINA }, { refrescarCada: enCurso ? 4000 : undefined });

  const [carpeta, setCarpeta] = useState("");
  const [confirmarDesconexion, setConfirmarDesconexion] = useState(false);
  const [reintentar, setReintentar] = useState(false);
  const [reprocesar, setReprocesar] = useState(false);

  // Al terminar una sincronización pueden haber cotizaciones, clientes y años nuevos.
  const estadoAnterior = useRef(progreso.data?.estado);
  useEffect(() => {
    const actual = progreso.data?.estado;
    if (estadoAnterior.current === "en_curso" && actual !== "en_curso") {
      for (const clave of ["cotizaciones", "clientes", "anios", "metricas", "drive"]) queryClient.invalidateQueries({ queryKey: [clave] });
    }
    estadoAnterior.current = actual;
  }, [progreso.data?.estado, queryClient]);

  useEffect(() => {
    if (estado.data?.carpeta_id && !carpeta) setCarpeta(estado.data.carpeta_id);
    // Solo al cargar el estado: no pisar lo que el usuario está escribiendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.data?.carpeta_id]);

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ["drive"] });

  const conectar = useMutation({
    mutationFn: () => api.autorizarDrive(),
    onSuccess: ({ authorization_url }) => {
      if (authorization_url.startsWith("/")) {
        refrescar();
        navegar(authorization_url);
      } else {
        window.location.assign(authorization_url);
      }
    },
  });

  const guardarCarpeta = useMutation({
    mutationFn: (valor: string) => api.definirCarpetaDrive(valor),
    onSuccess: (nuevo) => {
      queryClient.setQueryData(["drive", "estado"], nuevo);
      setCarpeta(nuevo.carpeta_id ?? "");
    },
  });

  const desconectar = useMutation({
    mutationFn: () => api.desconectarDrive(),
    onSuccess: () => {
      setConfirmarDesconexion(false);
      refrescar();
    },
  });

  const sincronizar = useMutation({
    mutationFn: () => api.sincronizarDrive(reintentar, reprocesar),
    onSuccess: (p) => {
      queryClient.setQueryData(["drive", "progreso"], p);
      if (p.estado !== "en_curso") refrescar();
    },
  });

  const cancelar = useMutation({
    mutationFn: () => api.cancelarSincronizacion(),
    onSuccess: (p) => queryClient.setQueryData(["drive", "progreso"], p),
  });

  function cambiarParams(cambios: Record<string, string | undefined>) {
    const nuevos = new URLSearchParams(params);
    nuevos.delete("drive");
    nuevos.delete("motivo");
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) nuevos.set(clave, valor);
      else nuevos.delete(clave);
    }
    setParams(nuevos);
  }

  function enviarCarpeta(e: FormEvent) {
    e.preventDefault();
    if (carpeta.trim()) guardarCarpeta.mutate(carpeta.trim());
  }

  if (estado.isPending) return <EstadoCarga />;
  if (estado.isError) return <EstadoError mensaje={mensaje(estado.error)} alReintentar={() => estado.refetch()} />;

  const e = estado.data;
  const listo = e.google_configurado && e.conectado && e.carpeta_configurada;

  return (
    <>
      <Encabezado titulo="Google Drive" descripcion="Conecta la carpeta donde se guardan las cotizaciones en PDF para que Cotiza+ las lea automáticamente." />

      {resultadoRetorno === "conectado" && (
        <Aviso tipo="ok">
          <p className="font-semibold text-vidrio-fuerte">Google Drive conectado</p>
          <p className="mt-0.5">{e.carpeta_configurada ? "Ya puedes sincronizar la carpeta." : "Ahora indica la carpeta que contiene las cotizaciones."}</p>
        </Aviso>
      )}
      {resultadoRetorno === "error" && (
        <Aviso tipo="error">
          <p className="font-semibold text-error">No se pudo conectar Google Drive</p>
          <p className="mt-0.5">{MOTIVOS[motivoRetorno ?? ""] ?? "Inténtalo de nuevo."}</p>
        </Aviso>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta titulo="1. Conexión">
          {!e.google_configurado ? (
            <p className="text-texto-suave">El servidor no tiene credenciales de Google. Pide al administrador que configure GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.</p>
          ) : e.conectado ? (
            <>
              <p className="flex items-center gap-2 font-medium">
                <span className="size-2.5 rounded-full bg-vidrio" aria-hidden /> Conectado
              </p>
              {e.fecha_conexion && <p className="mt-1 text-sm text-texto-suave">Desde el {formatFechaHora(e.fecha_conexion)}</p>}
              <p className="mt-1 text-sm text-texto-suave">Acceso de solo lectura: Cotiza+ nunca modifica tus archivos.</p>
              {confirmarDesconexion ? (
                <div className="mt-4 rounded-md border border-error/40 bg-error-tenue p-3">
                  <p className="text-sm">¿Desconectar Google Drive? Las cotizaciones ya importadas se mantienen.</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className={`${boton} bg-error text-white`} disabled={desconectar.isPending} onClick={() => desconectar.mutate()}>
                      Desconectar
                    </button>
                    <button type="button" className={botonSecundario} onClick={() => setConfirmarDesconexion(false)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className={botonSecundario} disabled={conectar.isPending} onClick={() => conectar.mutate()}>
                    Volver a conectar
                  </button>
                  <button type="button" className="px-2 text-sm font-medium text-error hover:underline" onClick={() => setConfirmarDesconexion(true)}>
                    Desconectar
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 font-medium">
                <span className="size-2.5 rounded-full bg-borde-fuerte" aria-hidden /> Sin conectar
              </p>
              <p className="mt-1 text-sm text-texto-suave">Te llevaremos a Google para autorizar el acceso de solo lectura a tu Drive.</p>
              <button type="button" className={`${botonPrincipal} mt-4`} disabled={conectar.isPending} onClick={() => conectar.mutate()}>
                {conectar.isPending ? "Abriendo Google…" : "Conectar Google Drive"}
              </button>
            </>
          )}
          {(conectar.isError || desconectar.isError) && <p className="mt-3 text-sm text-error">{mensaje(conectar.error ?? desconectar.error)}</p>}
        </Tarjeta>

        <Tarjeta titulo="2. Carpeta">
          <form onSubmit={enviarCarpeta}>
            <Campo etiqueta="Enlace o ID de la carpeta" id="carpeta">
              <Entrada id="carpeta" value={carpeta} onChange={(ev) => setCarpeta(ev.target.value)} placeholder="https://drive.google.com/drive/folders/…" />
            </Campo>
            <p className="mt-1 text-sm text-texto-suave">Abre la carpeta en Drive y copia la dirección del navegador. Se leen los PDF de esa carpeta (sin subcarpetas).</p>
            <button type="submit" className={`${botonSecundario} mt-3`} disabled={guardarCarpeta.isPending || !carpeta.trim() || carpeta.trim() === e.carpeta_id}>
              {guardarCarpeta.isPending ? "Guardando…" : "Guardar carpeta"}
            </button>
            {guardarCarpeta.isSuccess && <p className="mt-2 text-sm text-vidrio-fuerte">Carpeta guardada.</p>}
            {guardarCarpeta.isError && <p className="mt-2 text-sm text-error">{mensaje(guardarCarpeta.error)}</p>}
          </form>
        </Tarjeta>

        <Tarjeta titulo="3. Sincronización">
          <p className="text-sm text-texto-suave">Busca PDF nuevos en la carpeta, extrae sus datos y los guarda sin duplicar cotizaciones.</p>
          {enCurso && progreso.data ? (
            <AvanceSincronizacion p={progreso.data} cancelando={cancelar.isPending || cancelar.isSuccess} alCancelar={() => cancelar.mutate()} />
          ) : (
            <>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={reintentar} onChange={(ev) => setReintentar(ev.target.checked)} className="size-4 accent-vidrio" />
                Reintentar los documentos con error
              </label>
              <label className="mt-2 flex items-start gap-2 text-sm">
                <input type="checkbox" checked={reprocesar} onChange={(ev) => setReprocesar(ev.target.checked)} className="mt-0.5 size-4 accent-vidrio" />
                <span>
                  Volver a leer todos los PDF
                  <span className="block text-texto-suave">Actualiza los datos de las cotizaciones ya importadas (más lento).</span>
                </span>
              </label>
              <button type="button" className={`${botonPrincipal} mt-3`} disabled={!listo || sincronizar.isPending} onClick={() => sincronizar.mutate()}>
                {sincronizar.isPending ? "Iniciando…" : "Sincronizar ahora"}
              </button>
              {!listo && <p className="mt-2 text-sm text-texto-suave">Disponible cuando Drive esté conectado y la carpeta definida.</p>}
            </>
          )}
          {sincronizar.isError && <p className="mt-2 text-sm text-error">{mensaje(sincronizar.error)}</p>}
          {cancelar.isError && <p className="mt-2 text-sm text-error">{mensaje(cancelar.error)}</p>}
          {!enCurso && progreso.data && progreso.data.estado !== "inactivo" && <ResultadoSincronizacion p={progreso.data} />}
        </Tarjeta>
      </div>

      <section aria-label="Documentos" className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Documentos detectados</h2>
            {documentos.data && <p className="text-sm text-texto-suave">{plural(documentos.data.total, "documento")}</p>}
          </div>
          <Campo etiqueta="Estado" id="estado-doc" className="w-48">
            <Selector id="estado-doc" value={filtroEstado ?? ""} onChange={(ev) => cambiarParams({ estado: ev.target.value || undefined, page: undefined })}>
              <option value="">Todos</option>
              <option value="procesado">Procesados</option>
              <option value="duplicado">Duplicados</option>
              <option value="error">Con error</option>
            </Selector>
          </Campo>
        </div>

        {documentos.isPending ? (
          <EstadoCarga />
        ) : documentos.isError ? (
          <EstadoError mensaje={mensaje(documentos.error)} alReintentar={() => documentos.refetch()} />
        ) : documentos.data.items.length === 0 ? (
          <EstadoVacio
            titulo={filtroEstado ? "No hay documentos con ese estado" : "Aún no se han procesado documentos"}
            descripcion={filtroEstado ? undefined : "Conecta Google Drive, define la carpeta y sincroniza."}
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-borde bg-superficie">
              <table className="w-full min-w-[40rem] text-left">
                <thead className="border-b border-borde text-sm text-texto-suave">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">Archivo</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Estado</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Detalle</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Procesado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borde">
                  {documentos.data.items.map((d) => (
                    <tr key={d.id} className="align-top">
                      <td className="px-4 py-3">
                        {d.url_drive ? (
                          <a href={d.url_drive} target="_blank" rel="noreferrer" className="font-medium text-vidrio hover:underline">
                            {d.nombre_archivo}
                          </a>
                        ) : (
                          <span className="font-medium">{d.nombre_archivo}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-medium ${ESTADOS[d.estado].clase}`}>{ESTADOS[d.estado].texto}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {d.error && <p className="text-texto-suave">{d.error}</p>}
                        {d.cotizacion_id && (
                          <Link to={`/cotizaciones/${d.cotizacion_id}`} className="font-medium text-vidrio hover:underline">
                            Ver cotización
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap text-texto-suave">{d.fecha_procesamiento ? formatFechaHora(d.fecha_procesamiento) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacion pagina={pagina} tamano={TAMANO_PAGINA} total={documentos.data.total} alCambiar={(p) => cambiarParams({ page: p > 1 ? String(p) : undefined })} />
          </>
        )}
      </section>
    </>
  );
}
