/**
 * Dataset simulado y determinista (misma semilla → mismos datos) del rubro vidrio y aluminio.
 * Clientes, RUT y montos son ficticios: no se usan cotizaciones reales en el repositorio.
 */
import type { ClienteResumen, CotizacionDetalle, ItemCotizacion } from "../types";

function mulberry32(semilla: number) {
  let a = semilla;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const azar = mulberry32(20260831);
const entre = (min: number, max: number) => Math.floor(azar() * (max - min + 1)) + min;
function elegir<T>(lista: readonly T[]): T {
  return lista[Math.floor(azar() * lista.length)] as T;
}

export function digitoVerificador(cuerpo: number): string {
  let suma = 0;
  let multiplo = 2;
  for (const d of String(cuerpo).split("").reverse()) {
    suma += Number(d) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const resto = 11 - (suma % 11);
  return resto === 11 ? "0" : resto === 10 ? "K" : String(resto);
}

function rutFicticio(empresa: boolean): string {
  const cuerpo = empresa ? entre(76_000_000, 77_999_999) : entre(9_000_000, 21_999_999);
  return `${cuerpo.toLocaleString("es-CL")}-${digitoVerificador(cuerpo)}`;
}

const NOMBRES_CLIENTES = [
  ["Constructora Cordillera Sur Ltda.", true],
  ["Inmobiliaria Puerto Claro SpA", true],
  ["Edificaciones Valle Central S.A.", true],
  ["Arquitectura Mirador Estudio SpA", true],
  ["Clínica Dental Los Aromos", true],
  ["Hotel Bahía Serena", true],
  ["Colegio San Esteban de Maipú", true],
  ["Remodelaciones Andina SpA", true],
  ["Constructora Pehuén Ltda.", true],
  ["Oficinas Nueva Providencia S.A.", true],
  ["Restaurante Tierra de Fuego", true],
  ["Condominio Altos del Canelo", true],
  ["Gimnasio Fuerza Total SpA", true],
  ["Inversiones Quillay Ltda.", true],
  ["Ingeniería y Montajes Biobío SpA", true],
  ["Comunidad Edificio Mirasol", true],
  ["Patricia Soto Fuentes", false],
  ["Rodrigo Muñoz Pizarro", false],
  ["Camila Herrera Lagos", false],
  ["Felipe Araya Contreras", false],
  ["Daniela Rojas Vidal", false],
  ["Jorge Castillo Navarro", false],
  ["Valentina Reyes Toro", false],
  ["Sebastián Morales Díaz", false],
  ["Francisca Peña Olivares", false],
  ["Tomás Vergara Silva", false],
] as const;

export const clientes: ClienteResumen[] = NOMBRES_CLIENTES.map(([nombre, empresa], i) => ({
  id: i + 1,
  nombre,
  rut: i === 24 ? null : rutFicticio(empresa),
}));

// Peso relativo de cada cliente: las empresas cotizan más seguido y por montos mayores.
const pesos = NOMBRES_CLIENTES.map(([, empresa], i) => (empresa ? (i < 4 ? 9 : 4) : 1.4));
const sumaPesos = pesos.reduce((a, b) => a + b, 0);
function clienteAlAzar(): ClienteResumen {
  let r = azar() * sumaPesos;
  for (let i = 0; i < pesos.length; i++) {
    r -= pesos[i] as number;
    if (r <= 0) return clientes[i] as ClienteResumen;
  }
  return clientes[0] as ClienteResumen;
}

interface Producto {
  plantilla: () => string;
  unidad: string;
  precio: [number, number];
  cantidad: [number, number];
  decimal?: boolean;
}

const ANCHOS = [600, 800, 900, 1200, 1500, 1800, 2000, 2400];
const ALTOS = [600, 900, 1000, 1200, 1500, 2100];
const medida = () => `${elegir(ANCHOS)}x${elegir(ALTOS)} mm`;

const CATALOGO: Producto[] = [
  { plantilla: () => `Ventana corredera aluminio línea 20, ${medida()}, cristal 5 mm`, unidad: "un", precio: [95_000, 240_000], cantidad: [1, 12] },
  { plantilla: () => `Ventana proyectante aluminio línea 25, ${medida()}`, unidad: "un", precio: [110_000, 210_000], cantidad: [1, 8] },
  { plantilla: () => `Puerta de abatir aluminio línea 42, ${elegir([800, 900, 1000])}x2100 mm`, unidad: "un", precio: [320_000, 520_000], cantidad: [1, 4] },
  { plantilla: () => "Cristal templado incoloro 10 mm", unidad: "m²", precio: [62_000, 74_000], cantidad: [2, 40], decimal: true },
  { plantilla: () => "Cristal laminado 5+5 mm", unidad: "m²", precio: [48_000, 58_000], cantidad: [2, 30], decimal: true },
  { plantilla: () => "Termopanel DVH 4/12/4 mm", unidad: "m²", precio: [66_000, 79_000], cantidad: [3, 60], decimal: true },
  { plantilla: () => "Espejo 4 mm canto pulido", unidad: "m²", precio: [34_000, 42_000], cantidad: [1, 12], decimal: true },
  { plantilla: () => "Shower door cristal templado 8 mm, quincallería acero inoxidable", unidad: "un", precio: [260_000, 340_000], cantidad: [1, 3] },
  { plantilla: () => "Baranda cristal templado 10 mm con perfil U", unidad: "ml", precio: [130_000, 165_000], cantidad: [3, 28], decimal: true },
  { plantilla: () => "Mampara de oficina cristal 10 mm", unidad: "m²", precio: [115_000, 140_000], cantidad: [4, 30], decimal: true },
  { plantilla: () => "Fachada muro cortina con termopanel", unidad: "m²", precio: [190_000, 235_000], cantidad: [12, 70], decimal: true },
];
const SERVICIOS: Producto[] = [
  { plantilla: () => "Instalación y sellado con silicona estructural", unidad: "gl", precio: [120_000, 420_000], cantidad: [1, 1] },
  { plantilla: () => "Retiro de ventanas existentes", unidad: "gl", precio: [60_000, 150_000], cantidad: [1, 1] },
  { plantilla: () => "Flete a obra", unidad: "gl", precio: [35_000, 65_000], cantidad: [1, 1] },
];

let siguienteItemId = 1;
function generarItems(): ItemCotizacion[] {
  const productos = Array.from({ length: entre(1, 4) }, () => elegir(CATALOGO));
  if (azar() < 0.7) productos.push(elegir(SERVICIOS));
  if (azar() < 0.4) productos.push(SERVICIOS[2] as Producto);
  return productos.map((p, i) => {
    const cantidadBase = entre(p.cantidad[0], p.cantidad[1]);
    const cantidad = p.decimal ? Math.round((cantidadBase + azar()) * 10) / 10 : cantidadBase;
    const precio_unitario = Math.round(entre(p.precio[0], p.precio[1]) / 100) * 100;
    return {
      id: siguienteItemId++,
      linea: i + 1,
      descripcion: p.plantilla(),
      cantidad,
      unidad: p.unidad,
      precio_unitario,
      subtotal: Math.round(cantidad * precio_unitario),
    };
  });
}

const pad = (n: number, largo = 2) => String(n).padStart(largo, "0");
const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 28);
const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const idDrive = () => "1" + Array.from({ length: 32 }, () => elegir(ALFABETO.split(""))).join("");

export const cotizaciones: CotizacionDetalle[] = [];

(function generar() {
  let id = 1;
  // Ene-2024 a sep-2026, con crecimiento y estacionalidad (más obras en primavera/verano).
  for (let anio = 2024; anio <= 2026; anio++) {
    let correlativo = entre(100, 140);
    const ultimoMes = anio === 2026 ? 9 : 12;
    for (let mes = 1; mes <= ultimoMes; mes++) {
      const estacional = [1.2, 0.8, 1.0, 0.9, 0.8, 0.7, 0.7, 0.9, 1.1, 1.2, 1.3, 1.1][mes - 1] as number;
      const crecimiento = 1 + (anio - 2024) * 0.25;
      const cantidad = Math.round(entre(5, 8) * estacional * crecimiento);
      const dias = Array.from({ length: cantidad }, () => entre(1, mes === 2 ? 28 : 30)).sort((a, b) => a - b);
      for (const dia of dias) {
        const fecha = `${anio}-${pad(mes)}-${pad(dia)}`;
        const cliente = clienteAlAzar();
        const items = generarItems();
        const monto_neto = items.reduce((s, it) => s + it.subtotal, 0);
        const iva = Math.round(monto_neto * 0.19);
        const numero = `COT-${anio}-${pad(correlativo++, 4)}`;
        const drive_file_id = idDrive();
        cotizaciones.push({
          id,
          numero,
          fecha,
          cliente,
          cantidad_items: items.length,
          monto_neto,
          iva,
          total: monto_neto + iva,
          items,
          documento: {
            nombre_archivo: `Cotizacion_${numero}_${slug(cliente.nombre)}.pdf`,
            url_drive: `https://drive.google.com/file/d/${drive_file_id}/view`,
          },
        });
        id++;
      }
    }
  }
})();

export interface UsuarioMock {
  id: number;
  email: string;
  password: string;
  nombre: string;
}

export const usuarios: UsuarioMock[] = [{ id: 1, email: "demo@cotiza.test", password: "demo1234", nombre: "Usuario de prueba" }];
