// Lectura de la planilla de contenido de un cliente (circuito de
// "publicación directa", agencia/decision-circuito-publicacion-directa.md) y
// helpers para el cron de avisos de foto pendiente
// (agencia/decision-cron-avisos-fotos-pendientes.md).
//
// Lee el export público de Google Sheets (gviz/tq?tqx=out:csv) — funciona
// sin credenciales de Google porque la pestaña de publicaciones de cada
// cliente está compartida "Cualquiera con el enlace - Lector" (ver
// clientes/<cliente>/config-automatizacion.md de cada uno). Si algún día un
// cliente no puede compartirse así, este fetch simplemente no va a
// encontrar filas y hay que resolverlo con Sheets API + service account —
// no aplica todavía a ningún cliente cargado.
import { csvToObjects } from "./csv";

export type FilaPlanilla = {
  Fecha: string; // "D/M/YYYY" tal cual lo guarda Sheets, sin cero adelante
  Hora: string;
  Texto: string;
  Link_Imagen: string;
  Red: string;
  Estado: string;
  Publicado: string;
  Archivo: string;
  Observacion: string;
  Link_Drive: string;
  // Columna opcional: si el cliente/agencia la carga, se usa tal cual como
  // título corto en vez de inferirlo del Texto (ver buildTituloFoto). No
  // hace falta que exista — si no está, csvToObjects simplemente no la
  // incluye y buildTituloFoto cae al heurístico.
  Tema?: string;
};

export function urlCsvPlanilla(sheetId: string, gid: string) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

export async function fetchFilasPlanilla(sheetId: string, gid: string): Promise<FilaPlanilla[]> {
  const res = await fetch(urlCsvPlanilla(sheetId, gid), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`No se pudo leer la planilla (sheetId=${sheetId}, gid=${gid}): HTTP ${res.status}`);
  }
  const text = await res.text();
  return csvToObjects(text) as FilaPlanilla[];
}

// La columna Fecha de Sheets viene como "D/M/YYYY" sin ceros adelante (ver
// nota en clientes/*/config-automatizacion.md). new Date("15/9/2026") NO es
// confiable entre runtimes — se parsea a mano.
export function parseFechaPlanilla(fecha: string): Date | null {
  const m = fecha.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  // Mediodía UTC para no correr riesgo de cambiar de día por huso horario
  // al comparar solo por fecha calendario.
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 12));
}

// "Hoy" en fecha calendario de Argentina (UTC-3, sin horario de verano),
// como Date a mediodía UTC — comparable con parseFechaPlanilla().
export function hoyArgentina(): Date {
  const ahoraArg = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(ahoraArg.getUTCFullYear(), ahoraArg.getUTCMonth(), ahoraArg.getUTCDate(), 12));
}

export function diasHastaFecha(fecha: Date, hoy: Date): number {
  return Math.round((fecha.getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
}

export function formatFechaCorta(fecha: string): string {
  const m = fecha.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return fecha;
  const [, d, mo] = m;
  return `${d.padStart(2, "0")}/${mo.padStart(2, "0")}`;
}

// Palabras sin contenido propio — se saltan al armar el título heurístico
// para no terminar con algo como "una limpieza que va 15/09".
const STOPWORDS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al",
  "a", "en", "con", "por", "para", "que", "y", "o", "es", "se", "su", "sus",
]);

// Arma un título corto (2-4 palabras con contenido) + la fecha, para pedirle
// la foto al cliente y que conteste exactamente eso cuando el bot le
// pregunte para qué publicación es (mismo mecanismo que
// cursor-rules/revision-diaria.mdc paso 0.ter, ahora automático). Si la fila
// tiene una columna Tema cargada, se usa esa tal cual (mejor que cualquier
// heurístico) — conviene que la agencia la vaya completando al armar el
// copy de cada publicación.
export function buildTituloFoto(fila: FilaPlanilla): string {
  const fechaCorta = formatFechaCorta(fila.Fecha);

  if (fila.Tema && fila.Tema.trim()) {
    return `${fila.Tema.trim()} ${fechaCorta}`;
  }

  const palabras = fila.Texto
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // saca puntuación/precios/emoji
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w.toLowerCase()));

  const tema = palabras.slice(0, 3).join(" ").toLowerCase();
  return tema ? `${tema} ${fechaCorta}` : `publicación ${fechaCorta}`;
}

export function mensajeAvisoFotoPendiente(nombreCliente: string, titulo: string, fechaCorta: string): string {
  return `Hola ${nombreCliente}! Nos falta la foto para la publicación del ${fechaCorta}. Cuando la mandes, el bot te va a preguntar para qué publicación es — respondé exactamente "${titulo}" para que quede bien identificada. Gracias!`;
}
