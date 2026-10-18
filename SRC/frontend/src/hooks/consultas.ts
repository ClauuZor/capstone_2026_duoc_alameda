import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { FiltrosCotizaciones, FiltrosMetricas, Granularidad } from "../api/types";

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
