// Reemplazo de la planilla de Google Sheets — CRUD sobre la tabla
// Publicacion (ver prisma/schema.prisma y
// agencia/decision-cron-avisos-fotos-pendientes.md, sección "de Sheets a
// base propia"). Un cliente que ya migró no necesita compartir ni entender
// una planilla: todo vive en esta base, igual que Cliente/Solicitud.
import { prisma } from "./db";
import type { EstadoPublicacion } from "@prisma/client";

export async function listarPublicaciones(clienteSlug: string) {
  return prisma.publicacion.findMany({
    where: { clienteSlug },
    orderBy: [{ fecha: "asc" }, { hora: "asc" }],
  });
}

export async function obtenerPublicacion(id: string) {
  return prisma.publicacion.findUnique({ where: { id } });
}

export async function crearPublicacion(datos: {
  clienteSlug: string;
  fecha: Date;
  hora: string;
  texto: string;
  linkImagen?: string;
  red?: string;
  estado?: EstadoPublicacion;
  archivo?: string;
  observacion?: string;
  linkDrive?: string;
  tema?: string;
}) {
  return prisma.publicacion.create({ data: datos });
}

// Cambiar Estado es la única acción que hace un humano (Pablo, desde el
// dashboard /admin/contenido/[slug], o el bot cuando el cliente aprueba por
// WhatsApp) — nunca un cron ni un agente por su cuenta, misma regla de oro
// que ya regía sobre la columna Estado de la planilla vieja.
export async function cambiarEstadoPublicacion(id: string, estado: EstadoPublicacion) {
  return prisma.publicacion.update({ where: { id }, data: { estado } });
}

export async function actualizarPublicacion(
  id: string,
  datos: Partial<{
    fecha: Date;
    hora: string;
    texto: string;
    linkImagen: string | null;
    observacion: string | null;
    archivo: string | null;
    linkDrive: string | null;
    tema: string | null;
  }>,
) {
  return prisma.publicacion.update({ where: { id }, data: datos });
}

export async function marcarPublicada(id: string) {
  return prisma.publicacion.update({ where: { id }, data: { publicado: true } });
}

// Lo que hoy hacía la ruta `publicar_calendario` de Make consultando Google
// Sheets (Estado=Aprobado AND Publicado vacío AND Fecha=hoy) — ahora Make (o
// un cron propio, ver Pendiente en el decision doc) puede pedirle esto
// directo a la app. `hoy` se pasa siempre desde afuera (no se calcula acá)
// para no atarse a un huso horario fijo dentro de esta función.
export async function listarPendientesDePublicarHoy(hoy: Date, clienteSlug?: string) {
  const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate(), 0, 0, 0));
  const fin = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate(), 23, 59, 59));

  return prisma.publicacion.findMany({
    where: {
      estado: "APROBADO",
      publicado: false,
      fecha: { gte: inicio, lte: fin },
      ...(clienteSlug ? { clienteSlug } : {}),
    },
    orderBy: [{ hora: "asc" }],
  });
}
