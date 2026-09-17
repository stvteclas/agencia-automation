// Tools del MCP server — src/app/api/mcp/route.ts las registra sobre un
// McpServer de @modelcontextprotocol/sdk. Cada tool envuelve una función que
// YA existe en solicitudes.ts / publicaciones.ts / prisma (mismas que usan
// los endpoints /api/admin/*) — no se reimplementa ninguna lógica de
// negocio acá, solo se expone con un contrato tipado en vez de una URL con
// query params.
//
// Alcance: SOLO "Grupo A" según agencia/decision-mcp-bot-atencion-agencia.md
// (lectura, o transcripción de datos internos que ya no contactan a nadie
// por primera vez). Deliberadamente NO están acá: notificar-publicacion,
// avisar-foto-pendiente, resolverSolicitud con detalleResolucion (dispara
// WhatsApp al cliente), ni nada de whatsapp-templates?crear=true — esas
// acciones siguen siendo botón humano en /admin o cron del backend, nunca
// una tool que un agente pueda llamar solo. Ver ese documento para el
// razonamiento completo.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  listarSolicitudes,
  obtenerSolicitud,
  marcarAplicadaEnPlanilla,
  actualizarEstado,
} from "@/lib/solicitudes";
import {
  listarPublicaciones,
  obtenerPublicacion,
  crearPublicacion,
  actualizarPublicacion,
  marcarPublicada,
  listarPendientesDePublicarHoy,
} from "@/lib/publicaciones";
import { hoyArgentina } from "@/lib/planilla-contenido";
import { prisma } from "@/lib/db";
import { registrarLlamadaMcp } from "@/lib/mcp-log";
import type { EstadoSolicitud, TipoSolicitud, EstadoPublicacion } from "@prisma/client";

function textoJson(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

export function registrarTools(server: McpServer) {
  // Wrapper de logging: instrumenta cada tool sin que cada handler tenga
  // que acordarse de loguearse solo. Mismo contrato que server.tool(), así
  // que registrar una tool nueva más abajo sigue siendo "copiar el patrón
  // de la anterior" — nadie tiene que tocar este wrapper para sumar tools.
  function tool(
    nombre: string,
    descripcion: string,
    schema: Record<string, z.ZodTypeAny>,
    handler: (args: any) => Promise<{ content: { type: "text"; text: string }[] }>,
  ) {
    server.tool(nombre, descripcion, schema, async (args: any) => {
      const inicio = Date.now();
      try {
        const resultado = await handler(args);
        registrarLlamadaMcp({
          tool: nombre,
          args,
          ok: true,
          resultado,
          duracionMs: Date.now() - inicio,
        }).catch(() => {});
        return resultado;
      } catch (e) {
        registrarLlamadaMcp({
          tool: nombre,
          args,
          ok: false,
          errorMsg: e instanceof Error ? e.message : String(e),
          duracionMs: Date.now() - inicio,
        }).catch(() => {});
        throw e;
      }
    });
  }

  // --- Solicitudes (ALTA_CLIENTE / INCIDENCIA / TAREA_NUEVA / MODIFICACION / APROBACION_PUBLICACION) ---

  tool(
    "listar_solicitudes",
    "Lista Solicitudes del bot de atención (alta de cliente, incidencias, tareas, modificaciones, aprobaciones de publicación). Filtros opcionales.",
    {
      telefono: z.string().optional().describe("Filtra por teléfono del cliente"),
      tipo: z
        .enum(["ALTA_CLIENTE", "INCIDENCIA", "TAREA_NUEVA", "MODIFICACION", "APROBACION_PUBLICACION"])
        .optional(),
      estado: z.enum(["NUEVA", "EN_PROCESO", "RESUELTA"]).optional(),
      aplicado: z.boolean().optional().describe("Solo para APROBACION_PUBLICACION: filtra por aplicadoEnPlanilla"),
    },
    async ({ telefono, tipo, estado, aplicado }) => {
      const solicitudes = await listarSolicitudes(
        estado as EstadoSolicitud | undefined,
        telefono,
        tipo as TipoSolicitud | undefined,
        aplicado,
      );
      return textoJson({ solicitudes });
    },
  );

  tool(
    "obtener_solicitud",
    "Trae el detalle completo de una Solicitud por id.",
    { id: z.string() },
    async ({ id }) => {
      const solicitud = await obtenerSolicitud(id);
      if (!solicitud) return textoJson({ error: "No existe" });
      return textoJson({ solicitud });
    },
  );

  tool(
    "marcar_solicitud_aplicada",
    "Marca una APROBACION_PUBLICACION como ya trasladada a la planilla/base de publicaciones (aplicadoEnPlanilla=true). No le escribe nada al cliente — es una anotación interna para que la revisión diaria no la vuelva a procesar.",
    { id: z.string() },
    async ({ id }) => {
      const solicitud = await marcarAplicadaEnPlanilla(id);
      return textoJson({ solicitud });
    },
  );

  tool(
    "actualizar_solicitud_interna",
    "Actualiza el estado (solo a EN_PROCESO) y/o la nota interna de una Solicitud. A propósito NO permite pasar a RESUELTA con detalleResolucion desde acá — eso dispara un WhatsApp automático al cliente y queda fuera del MCP por diseño (ver agencia/decision-mcp-bot-atencion-agencia.md); resolver un ticket avisando al cliente se sigue haciendo a mano desde /admin.",
    {
      id: z.string(),
      notaInterna: z.string().optional(),
      marcarEnProceso: z.boolean().optional().describe("true para pasar el estado a EN_PROCESO"),
    },
    async ({ id, notaInterna, marcarEnProceso }) => {
      // Ojo acá: antes esto pasaba SIEMPRE "EN_PROCESO" a actualizarEstado
      // (bug encontrado el 17/09/2026 al diseñar el logging), así que
      // agregar una nota interna a una solicitud ya RESUELTA la hacía
      // retroceder de estado sin que nadie lo pidiera. Ahora: si
      // marcarEnProceso no es true, se actualiza SOLO la nota, sin tocar
      // estado — actualizarEstado() siempre escribe el campo estado
      // (ver solicitudes.ts), así que para "solo nota" hay que ir directo
      // a prisma en vez de reusar esa función con un estado inventado.
      const solicitud = marcarEnProceso
        ? await actualizarEstado(id, "EN_PROCESO" as EstadoSolicitud, notaInterna)
        : await prisma.solicitud.update({ where: { id }, data: { notaInterna } });
      return textoJson({ solicitud, nota: "Si necesitás marcar RESUELTA con aviso al cliente, hacelo desde /admin (fuera del MCP a propósito)." });
    },
  );

  // --- Publicaciones (tabla Publicacion — alternativa a Google Sheets) ---

  tool(
    "listar_publicaciones",
    "Lista publicaciones de un cliente. Con pendientesHoy=true, trae solo las Aprobado+sin publicar con fecha de hoy (equivalente a lo que antes leía Make de Google Sheets en la ruta publicar_calendario).",
    {
      slug: z.string().optional().describe("Slug del cliente. Sin esto, con pendientesHoy=true trae de todos los clientes."),
      pendientesHoy: z.boolean().optional(),
    },
    async ({ slug, pendientesHoy }) => {
      if (pendientesHoy) {
        const publicaciones = await listarPendientesDePublicarHoy(hoyArgentina(), slug);
        return textoJson({ publicaciones });
      }
      if (!slug) return textoJson({ error: "Sin pendientesHoy=true hace falta slug" });
      const publicaciones = await listarPublicaciones(slug);
      return textoJson({ publicaciones });
    },
  );

  tool(
    "obtener_publicacion",
    "Trae el detalle de una publicación por id.",
    { id: z.string() },
    async ({ id }) => {
      const publicacion = await obtenerPublicacion(id);
      if (!publicacion) return textoJson({ error: "No existe" });
      return textoJson({ publicacion });
    },
  );

  tool(
    "cargar_publicacion",
    "Carga una fila nueva de contenido para un cliente en base propia (reemplazo de agregar_completo de Make para un cliente que ya no usa Sheets).",
    {
      clienteSlug: z.string(),
      fecha: z.string().describe("Fecha ISO, ej. 2026-09-20"),
      hora: z.string().describe("HH:MM"),
      texto: z.string(),
      linkImagen: z.string().optional(),
      estado: z.enum(["ESPERANDO_FOTO", "PENDIENTE", "APROBADO", "DENEGADO"]).optional(),
      archivo: z.string().optional(),
      observacion: z.string().optional(),
      linkDrive: z.string().optional(),
      tema: z.string().optional(),
    },
    async ({ clienteSlug, fecha, hora, texto, linkImagen, estado, archivo, observacion, linkDrive, tema }) => {
      const publicacion = await crearPublicacion({
        clienteSlug,
        fecha: new Date(fecha),
        hora,
        texto,
        linkImagen,
        estado: estado as EstadoPublicacion | undefined,
        archivo,
        observacion,
        linkDrive,
        tema,
      });
      return textoJson({ publicacion });
    },
  );

  tool(
    "actualizar_publicacion",
    "Edita campos de una publicación existente (fecha, hora, texto, estado, linkImagen, etc.) — para reordenar el calendario o transcribir una decisión de Estado que el cliente ya tomó (ver paso 0.bis/0.ter de la revisión diaria). No dispara ningún mensaje a nadie por sí sola.",
    {
      id: z.string(),
      fecha: z.string().optional().describe("Fecha ISO"),
      hora: z.string().optional(),
      texto: z.string().optional(),
      estado: z.enum(["ESPERANDO_FOTO", "PENDIENTE", "APROBADO", "DENEGADO"]).optional(),
      linkImagen: z.string().optional(),
      observacion: z.string().optional(),
      tema: z.string().optional(),
    },
    async ({ id, ...campos }) => {
      const { fecha, ...resto } = campos;
      const publicacion = await actualizarPublicacion(id, {
        ...resto,
        ...(fecha ? { fecha: new Date(fecha) } : {}),
      } as Parameters<typeof actualizarPublicacion>[1]);
      return textoJson({ publicacion });
    },
  );

  tool(
    "marcar_publicacion_publicada",
    "Marca publicado=true en una fila (equivalente al Update Row 'Publicado=si' de Make). Anotación interna, no contacta a nadie — la publicación real en Meta la sigue haciendo el escenario de Make/backend, esto solo refleja que ya se hizo.",
    { id: z.string() },
    async ({ id }) => {
      const publicacion = await marcarPublicada(id);
      return textoJson({ publicacion });
    },
  );

  // --- Configuración de clientes (cron de avisos de foto pendiente) ---

  tool(
    "listar_clientes_contenido",
    "Lista todos los clientes configurados en ClienteContenidoConfig (activos e inactivos).",
    {},
    async () => {
      const clientes = await prisma.clienteContenidoConfig.findMany({ orderBy: { creadoEn: "asc" } });
      return textoJson({ clientes });
    },
  );

  tool(
    "alta_cliente_contenido",
    "Alta o edición (upsert por slug) de un cliente en ClienteContenidoConfig — activa el cron de avisos de foto pendiente para ese cliente. No manda ningún mensaje al darlo de alta.",
    {
      slug: z.string(),
      nombre: z.string(),
      telefonoAviso: z.string(),
      planillaSheetId: z.string().nullable().optional().describe("null explícito para sacarlo de Sheets"),
      planillaGid: z.string().optional(),
      ventanaAvisoDias: z.number().optional(),
      activo: z.boolean().optional(),
    },
    async ({ slug, nombre, telefonoAviso, planillaSheetId, planillaGid, ventanaAvisoDias, activo }) => {
      const cliente = await prisma.clienteContenidoConfig.upsert({
        where: { slug },
        create: {
          slug,
          nombre,
          telefonoAviso,
          planillaSheetId: planillaSheetId ?? null,
          planillaGid: planillaGid ?? "0",
          ventanaAvisoDias: ventanaAvisoDias ?? 5,
          activo: activo ?? true,
        },
        update: {
          nombre,
          telefonoAviso,
          ...(planillaSheetId !== undefined ? { planillaSheetId } : {}),
          ...(planillaGid !== undefined ? { planillaGid } : {}),
          ...(ventanaAvisoDias !== undefined ? { ventanaAvisoDias } : {}),
          ...(activo !== undefined ? { activo } : {}),
        },
      });
      return textoJson({ cliente });
    },
  );

  // --- Registro de avisos de foto pendiente (solo lectura/limpieza, el envío en sí es del cron) ---

  tool(
    "listar_avisos_fotos_pendientes",
    "Lista los avisos de 'foto pendiente' ya registrados para un cliente (tabla AvisoFotoPendiente) — para revisar si el cron los mandó bien.",
    { clienteSlug: z.string() },
    async ({ clienteSlug }) => {
      const avisos = await prisma.avisoFotoPendiente.findMany({
        where: { clienteSlug },
        orderBy: [{ fecha: "asc" }, { hora: "asc" }],
      });
      return textoJson({ avisos });
    },
  );

  tool(
    "eliminar_registro_aviso_foto_pendiente",
    "Borra un registro puntual de AvisoFotoPendiente (para que el cron lo vuelva a intentar la próxima corrida) — usar cuando un aviso quedó marcado como enviado pero el WhatsApp real nunca llegó. Esto NO manda ningún mensaje, solo borra el registro interno.",
    { clienteSlug: z.string(), fecha: z.string(), hora: z.string() },
    async ({ clienteSlug, fecha, hora }) => {
      const eliminado = await prisma.avisoFotoPendiente.deleteMany({ where: { clienteSlug, fecha, hora } });
      return textoJson({ eliminados: eliminado.count });
    },
  );

  // --- Auditoría del propio MCP ---

  tool(
    "listar_logs_mcp",
    "Lista el registro de llamadas al MCP (tabla McpToolLog) — qué tool se llamó, cuándo, con qué input y si salió bien. Equivalente al historial del browser en el patrón viejo de navegación con ADMIN_API_KEY. Trae las más recientes primero.",
    {
      tool: z.string().optional().describe("Filtra por nombre de tool, ej. 'cargar_publicacion'"),
      soloErrores: z.boolean().optional(),
      limite: z.number().optional().describe("Default 50, máximo 200"),
    },
    async ({ tool: nombreTool, soloErrores, limite }) => {
      const take = Math.min(limite ?? 50, 200);
      const logs = await prisma.mcpToolLog.findMany({
        where: {
          ...(nombreTool ? { tool: nombreTool } : {}),
          ...(soloErrores ? { ok: false } : {}),
        },
        orderBy: { creadoEn: "desc" },
        take,
      });
      return textoJson({ logs });
    },
  );
}
