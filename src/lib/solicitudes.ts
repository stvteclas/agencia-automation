import { prisma } from "./db";
import { sendWhatsappText } from "./whatsapp";
import { notifyOwnerByEmail } from "./email";
import type { EstadoSolicitud, TipoSolicitud, RespuestaAprobacion } from "@prisma/client";

const ETIQUETA_TIPO: Record<TipoSolicitud, string> = {
  ALTA_CLIENTE: "Alta de cliente nuevo",
  INCIDENCIA: "Incidencia",
  TAREA_NUEVA: "Tarea nueva",
  MODIFICACION: "Modificación",
  APROBACION_PUBLICACION: "Aprobación de publicación",
};

export function etiquetaTipo(tipo: TipoSolicitud) {
  return ETIQUETA_TIPO[tipo];
}

// `telefono` filtra por el teléfono exacto que originó la Solicitud — lo usa
// la revisión diaria de cada cliente para traer solo lo suyo (ver
// GET /api/admin/solicitudes en route.ts). `tipo` lo usa la revisión diaria
// para traer solo las APROBACION_PUBLICACION. `aplicadoEnPlanilla`, cuando se
// pasa `false`, filtra las APROBACION_PUBLICACION ya trasladadas a la
// planilla — así la revisión diaria no reprocesa la misma dos veces.
export async function listarSolicitudes(
  estado?: EstadoSolicitud,
  telefono?: string,
  tipo?: TipoSolicitud,
  aplicadoEnPlanilla?: boolean,
) {
  return prisma.solicitud.findMany({
    where: {
      ...(estado ? { estado } : {}),
      ...(telefono ? { telefono } : {}),
      ...(tipo ? { tipo } : {}),
      ...(aplicadoEnPlanilla === undefined ? {} : { aplicadoEnPlanilla }),
    },
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
// (igual que notifyOwnerByEmail cuando faltan sus variables). Exportada
// porque conversation.ts también la usa para avisar cuando un cliente pide
// cambios sobre una pieza.
export async function notifyOwnerByWhatsapp(texto: string) {
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

// --- Aprobación de publicaciones (reemplaza que el cliente edite Estado a mano) ---

// Busca si ya hay una APROBACION_PUBLICACION esperando respuesta de este
// teléfono. Se usa en dos lugares: (1) notificar-publicacion la consulta
// antes de crear una nueva, para no mandar dos avisos de la misma pieza si
// la revisión diaria se dispara dos veces por error; (2) el motor de
// conversación la consulta en CADA mensaje entrante del cliente, antes que
// nada, para saber si esa respuesta hay que interpretarla como aprobación o
// como un mensaje nuevo del flujo normal.
export async function buscarAprobacionPendiente(telefono: string) {
  return prisma.solicitud.findFirst({
    where: { telefono, tipo: "APROBACION_PUBLICACION", estado: "NUEVA" },
    orderBy: { creadoEn: "asc" }, // si hay más de una, se resuelve la más vieja primero
  });
}

// Crea la Solicitud de aprobación y le manda el WhatsApp al cliente con el
// link de la pieza. A diferencia de crearSolicitud() (usada para
// alta/incidencia/tarea/modificación), NO avisa a Pablo por mail/WhatsApp acá
// — es un paso rutinario que dispara la propia revisión diaria, no hace
// falta un aviso por cada pieza; si el cliente pide cambios, ahí sí se le
// avisa (ver registrarRespuestaAprobacion).
export async function crearAprobacionPublicacion(datos: {
  telefono: string;
  archivo: string;
  linkPreview: string;
  nombreNegocio?: string;
}) {
  const solicitud = await prisma.solicitud.create({
    data: {
      tipo: "APROBACION_PUBLICACION",
      telefono: datos.telefono,
      archivo: datos.archivo,
      linkPreview: datos.linkPreview,
    },
  });

  await sendWhatsappText(
    datos.telefono,
    `¡Hola${datos.nombreNegocio ? " " + datos.nombreNegocio : ""}! Tenés una pieza nueva para revisar 📩\n${datos.linkPreview}\n\nRespondé APROBAR si te gusta, o contame qué cambiarías.`,
  );

  return solicitud;
}

// El cliente ya contestó (aprobó o pidió cambios). Guarda la respuesta y,
// si pidió cambios, avisa a Pablo por WhatsApp con el comentario (necesita
// corregir la pieza). La confirmación al cliente la manda el motor de
// conversación en el momento (tiene el hilo abierto), no esta función.
export async function registrarRespuestaAprobacion(
  id: string,
  respuesta: RespuestaAprobacion,
  comentario?: string,
) {
  const solicitud = await prisma.solicitud.update({
    where: { id },
    data: {
      estado: "RESUELTA",
      respuestaAprobacion: respuesta,
      descripcion: comentario,
      resueltoEn: new Date(),
    },
  });

  if (respuesta === "CAMBIOS") {
    await notifyOwnerByWhatsapp(
      `✏️ Pidieron cambios en una pieza\nTel: ${solicitud.telefono}\nArchivo: ${solicitud.archivo ?? "-"}\n\nComentario: ${comentario ?? "(sin comentario)"}\n\nEntrá a /admin para verla.`,
    );
  }

  return solicitud;
}

// La revisión diaria, después de trasladar la respuesta a la planilla
// (Estado=Aprobado/Denegado vía el webhook de Make), marca la Solicitud como
// aplicada para no volver a procesarla la próxima vez que consulte
// ?tipo=APROBACION_PUBLICACION&estado=RESUELTA.
export async function marcarAplicadaEnPlanilla(id: string) {
  return prisma.solicitud.update({ where: { id }, data: { aplicadoEnPlanilla: true } });
}
