import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enviarAvisoFotoPendiente } from "@/lib/whatsapp";
import { notifyOwnerByWhatsapp } from "@/lib/solicitudes";
import {
  fetchFilasPlanilla,
  parseFechaPlanilla,
  hoyArgentina,
  diasHastaFecha,
  formatFechaCorta,
  buildTituloFoto,
  mensajeAvisoFotoPendiente,
  type FilaPlanilla,
} from "@/lib/planilla-contenido";

// Un cliente ya migrado a la base propia (planillaSheetId null — ver
// agencia/decision-cron-avisos-fotos-pendientes.md) no tiene CSV para leer:
// se traen sus filas "Esperando foto" directo de Publicacion y se
// convierten a la misma forma que una fila de la planilla vieja, para que
// el resto de esta función (buildTituloFoto, el chequeo de ventana, etc.)
// no tenga que saber de dónde vino cada fila.
async function filasEsperandoFotoDesdeBase(clienteSlug: string): Promise<FilaPlanilla[]> {
  const filas = await prisma.publicacion.findMany({
    where: { clienteSlug, estado: "ESPERANDO_FOTO" },
  });
  return filas.map((f) => ({
    Fecha: `${f.fecha.getUTCDate()}/${f.fecha.getUTCMonth() + 1}/${f.fecha.getUTCFullYear()}`,
    Hora: f.hora,
    Texto: f.texto,
    Link_Imagen: f.linkImagen ?? "",
    Red: f.red ?? "",
    Estado: "Esperando foto",
    Publicado: f.publicado ? "si" : "",
    Archivo: f.archivo ?? "",
    Observacion: f.observacion ?? "",
    Link_Drive: f.linkDrive ?? "",
    Tema: f.tema ?? undefined,
  }));
}

// GET /api/cron/avisos-fotos-pendientes
//
// Reemplaza, para el circuito de "publicación directa"
// (agencia/decision-circuito-publicacion-directa.md), el paso 0.ter.a de
// cursor-rules/revision-diaria.mdc — que hasta el 15/09/2026 lo ejecutaba
// Claude a mano cada día, leyendo la planilla por navegador y disparando
// avisar-foto-pendiente. Ese paso mandaba un WhatsApp real a un tercero
// (el cliente) como acción de un agente autónomo, algo que el modo
// automático de Claude bloquea por diseño ("Real-World Transactions") — no
// es destrabable con una config ni con una confirmación puntual en el chat.
// La única forma de que esto escale a muchos clientes sin depender de que
// alguien esté en el chat todos los días es que el propio backend lo
// dispare solo, sin un agente de IA en el medio. Ver
// agencia/decision-cron-avisos-fotos-pendientes.md para el diseño completo.
//
// Corre para TODOS los clientes activos en ClienteContenidoConfig (no es
// específico de un cliente) — así escala sin tocar código por cada alta
// nueva, solo agregando una fila de config.
//
// Autenticación: dos vías, para los dos disparadores que hacen falta —
// 1. Vercel Cron (automático, "se dispara solo"): header
//    Authorization: Bearer <CRON_SECRET>, que Vercel agrega solo si el cron
//    está declarado en vercel.json y CRON_SECRET está seteado en el proyecto.
// 2. Pablo a mano con curl: header x-admin-key o ?key=..., misma
//    ADMIN_API_KEY que ya usan el resto de los endpoints /api/admin/*.
function autorizado(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`) return true;

  const claveAdmin = process.env.ADMIN_API_KEY;
  if (!claveAdmin) return false;
  return req.headers.get("x-admin-key") === claveAdmin || req.nextUrl.searchParams.get("key") === claveAdmin;
}

type ResultadoCliente = {
  slug: string;
  nombre: string;
  avisosEnviados: { fecha: string; hora: string; titulo: string; via: string; metaStatus?: number; metaRespuesta?: string }[];
  error?: string;
};

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Filtro opcional para probar/forzar un solo cliente sin correr todos:
  // ?slug=romina-balquinta
  const slugFiltro = req.nextUrl.searchParams.get("slug");

  const clientes = await prisma.clienteContenidoConfig.findMany({
    where: { activo: true, ...(slugFiltro ? { slug: slugFiltro } : {}) },
  });

  const hoy = hoyArgentina();
  const resultados: ResultadoCliente[] = [];

  for (const cliente of clientes) {
    const resultado: ResultadoCliente = { slug: cliente.slug, nombre: cliente.nombre, avisosEnviados: [] };

    try {
      const filas = cliente.planillaSheetId
        ? await fetchFilasPlanilla(cliente.planillaSheetId, cliente.planillaGid)
        : await filasEsperandoFotoDesdeBase(cliente.slug);

      for (const fila of filas) {
        if (fila.Estado !== "Esperando foto") continue;

        const fecha = parseFechaPlanilla(fila.Fecha);
        if (!fecha) continue; // fila sin Fecha completa todavía — no hay nada que avisar

        const dias = diasHastaFecha(fecha, hoy);
        if (dias > cliente.ventanaAvisoDias) continue; // todavía falta mucho

        // Ya se le avisó de esta fila puntual (fecha+hora es la clave — ver
        // AvisoFotoPendiente en el schema). No reintentar todos los días.
        const yaAvisado = await prisma.avisoFotoPendiente.findUnique({
          where: { clienteSlug_fecha_hora: { clienteSlug: cliente.slug, fecha: fila.Fecha, hora: fila.Hora } },
        });
        if (yaAvisado) continue;

        const fechaCorta = formatFechaCorta(fila.Fecha);
        const titulo = buildTituloFoto(fila);
        const primerNombre = cliente.nombre.split(" ")[0];
        const mensaje = mensajeAvisoFotoPendiente(primerNombre, titulo, fechaCorta);

        const envio = await enviarAvisoFotoPendiente(cliente.telefonoAviso, primerNombre, fechaCorta, titulo, mensaje);

        // Si Meta rechazó el envío (ej. requiere plantilla aprobada para
        // mensajes que inicia la agencia sin que el cliente haya escrito
        // antes en las últimas 24hs), NO se marca como avisado — si no, el
        // cron nunca vuelve a intentarlo y el cliente se queda sin el aviso
        // para siempre sin que nadie se entere (bug real, 15/09/2026: pasó
        // con los 3 avisos de prueba de Romina, ninguno le llegó).
        if (!envio.ok) {
          resultado.error = `WhatsApp rechazó el aviso de ${fila.Fecha} ${fila.Hora} (${titulo}): ${envio.error ?? envio.status}`;
          await notifyOwnerByWhatsapp(
            `⚠️ No se pudo avisar a ${cliente.nombre} (${cliente.slug}) — ${fila.Fecha} ${fila.Hora}, "${titulo}": ${resultado.error}`,
          );
          continue;
        }

        await prisma.avisoFotoPendiente.create({
          data: {
            clienteSlug: cliente.slug,
            fecha: fila.Fecha,
            hora: fila.Hora,
            archivo: fila.Archivo || null,
            tituloUsado: titulo,
          },
        });

        resultado.avisosEnviados.push({
          fecha: fila.Fecha,
          hora: fila.Hora,
          titulo,
          via: envio.via,
          metaStatus: envio.status,
          metaRespuesta: envio.respuesta,
        });
      }
    } catch (err) {
      resultado.error = err instanceof Error ? err.message : String(err);
      await notifyOwnerByWhatsapp(
        `⚠️ El cron de avisos de foto pendiente falló para ${cliente.nombre} (${cliente.slug}): ${resultado.error}`,
      );
    }

    resultados.push(resultado);
  }

  return NextResponse.json({ ejecutadoEn: new Date().toISOString(), clientes: resultados });
}
