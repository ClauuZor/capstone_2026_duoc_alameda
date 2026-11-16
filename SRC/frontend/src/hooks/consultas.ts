import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Dimension, FiltrosCotizaciones, FiltrosDocumentos, FiltrosMetricas, Granularidad } from "../api/types";

export const useDistribucion = (f: FiltrosMetricas & { dimension: Dimension; limite?: number }) =>
  useQuery({ queryKey: ["metricas", "distribucion", f], queryFn: () => api.metricasDistribucion(f), placeholderData: keepPreviousData });

export const useOpcionesFiltro = () => useQuery({ queryKey: ["opciones-filtro"], queryFn: () => api.opcionesFiltro(), staleTime: 5 * 60_000 });

export const useEstadoDrive = () => useQuery({ queryKey: ["drive", "estado"], queryFn: () => api.estadoDrive() });

/** Mientras la sincronización está en curso, consulta el avance cada segundo y medio. */
export const useProgresoIngesta = () =>
  useQuery({
    queryKey: ["drive", "progreso"],
    queryFn: () => api.progresoSincronizacion(),
    staleTime: 0,
    refetchInterval: (q) => (q.state.data?.estado === "en_curso" ? 1500 : false),
  });

export const useDocumentos = (f: FiltrosDocumentos, { refrescarCada }: { refrescarCada?: number } = {}) =>
  useQuery({
    queryKey: ["drive", "documentos", f],
    queryFn: () => api.listarDocumentos(f),
    placeholderData: keepPreviousData,
    refetchInterval: refrescarCada ?? false,
  });

export const useCotizaciones = (f: FiltrosCotizaciones) =>
  useQuery({ queryKey: ["cotizaciones", f], queryFn: () => api.listarCotizaciones(f), placeholderData: keepPreviousData });

export const useCotizacion = (id: number | null) =>
  useQuery({ queryKey: ["cotizacion", id], queryFn: () => api.obtenerCotizacion(id as number), enabled: id !== null });

export const useClientes = () => useQuery({ queryKey: ["clientes"], queryFn: () => api.listarClientes(), staleTime: 5 * 60_000 });

export const useAnios = () => useQuery({ queryKey: ["anios"], queryFn: () => api.aniosDisponibles(), staleTime: 5 * 60_000 });

export const useMetricasResumen = (f: FiltrosMetricas) =>
  useQuery({ queryKey: ["metricas", "resumen", f], queryFn: () => api.metricasResumen(f), placeholderData: keepPreviousData });

export const useMetricasPeriodo = (f: FiltrosMetricas & { granularidad: Granularidad }) =>
  useQuery({ queryKey: ["metricas", "periodo", f], queryFn: () => api.metricasPorPeriodo(f), placeholderData: keepPreviousData });
