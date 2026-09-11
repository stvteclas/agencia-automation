import { prisma } from "./db";
import { sendWhatsappText } from "./whatsapp";
import { notifyOwnerByEmail } from "./email";
import type { EstadoSolicitud, TipoSolicitud } from "@prisma/client";

const ETIQUETA_TIPO: Record<TipoSolicitud, string> = {
  ALTA_CLIENTE: "Alta de cliente nuevo",
  INCIDENCIA: "Incidencia",
  TAREA_NUEVA: "Tarea nueva",
  MODIFICACION: "Modificación",
};

export function etiquetaTipo(tipo: TipoSolicitud) {
  return ETIQUETA_TIPO[tipo];
}

export async function listarSolicitudes(estado?: EstadoSolicitud) {
  return prisma.solicitud.findMany({
    where: estado ? { estado } : undefined,
    orderBy: { creadoEn: "desc" },
  });
}

export async function obtenerSolicitud(id: string) {
  return prisma.solicitud.findUnique({ where: { id } });
}

// Crea la Solicitud y dispara el aviso por mail a Pablo. La confirmación al
// cliente por WhatsApp la manda el motor de conversación (ya tiene el hilo
// abierto en ese momento), no esta función.
export async function crearSolicitud(datos: {
  tipo: TipoSolicitud;
  telefono: string;
  nombre?: string;
  aplicativo?: string;
  descripcion?: string;
  respuestas?: Record<string, string>;
}) {
  const solicitud = await prisma.solicitud.create({
    data: {
      tipo: datos.tipo,
      telefono: datos.telefono,
      nombre: datos.nombre,
      aplicativo: datos.aplicativo,
      descripcion: datos.descripcion,
      respuestas: datos.respuestas,
    },
  });

  const resumen =
    datos.tipo === "ALTA_CLIENTE"
      ? `Negocio: ${datos.respuestas?.nombre_negocio ?? "(sin nombre)"}\nRubro: ${datos.respuestas?.rubro ?? "-"}`
      : `Nombre: ${datos.nombre ?? "-"}\nAplicativo: ${datos.aplicativo ?? "-"}\nDescripción: ${datos.descripcion ?? "-"}`;

  await notifyOwnerByEmail(
    `Nuevo — ${etiquetaTipo(datos.tipo)} (${datos.telefono})`,
    `Entró una solicitud nueva por el bot de WhatsApp.\n\nTipo: ${etiquetaTipo(datos.tipo)}\nTeléfono: ${datos.telefono}\n\n${resumen}\n\nRevisala en el panel /admin o con GET /api/admin/solicitudes.`,
  );

  await notifyOwnerByWhatsapp(
    `📌 Nuevo — ${etiquetaTipo(datos.tipo)}\nTel: ${datos.telefono}\n\n${resumen}\n\nEntrá al panel /admin para verla completa.`,
  );

  return solicitud;
}

// Avisa al jefe (Pablo) por WhatsApp cuando entra algo para revisar/reparar.
// Usa el mismo número/token del bot para mandarse el mensaje a sí mismo a un
// número distinto (OWNER_WHATSAPP). Si no está configurado, no hace nada
// (igual que notifyOwnerByEmail cuando faltan sus variables).
async function notifyOwnerByWhatsapp(texto: string) {
  const ownerPhone = process.env.OWNER_WHATSAPP;
  if (!ownerPhone) {
    console.error("Falta OWNER_WHATSAPP en el .env — no se pudo avisar por WhatsApp al jefe");
    return;
  }
  await sendWhatsappText(ownerPhone, texto);
}

// Marca una Solicitud como resuelta y, si hay detalle, le avisa al cliente
// por WhatsApp con ese mismo texto — así no hace falta entrar a WhatsApp Web
// a mano para cerrar el círculo.
export async function resolverSolicitud(id: string, detalleResolucion: string | undefined, notaInterna?: string) {
  const solicitud = await prisma.solicitud.update({
    where: { id },
    data: {
      estado: "RESUELTA",
      detalleResolucion,
      notaInterna,
      resueltoEn: new Date(),
    },
  });

  if (detalleResolucion) {
    await sendWhatsappText(
      solicitud.telefono,
      `Hola! Te escribimos para contarte que ya resolvimos tu ${etiquetaTipo(solicitud.tipo).toLowerCase()}:\n\n${detalleResolucion}\n\nCualquier cosa, escribinos por acá.`,
    );
  }

  return solicitud;
}

export async function actualizarEstado(id: string, estado: EstadoSolicitud, notaInterna?: string) {
  return prisma.solicitud.update({ where: { id }, data: { estado, notaInterna } });
}
