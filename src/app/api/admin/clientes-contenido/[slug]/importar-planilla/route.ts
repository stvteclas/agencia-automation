import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchFilasPlanilla, parseFechaPlanilla } from "@/lib/planilla-contenido";
import type { EstadoPublicacion } from "@prisma/client";

function autorizado(req: NextRequest) {
  const clave = process.env.ADMIN_API_KEY;
  if (!clave) return false;
  return req.headers.get("x-admin-key") === clave || req.nextUrl.searchParams.get("key") === clave;
}

const ESTADO_PLANILLA_A_ENUM: Record<string, EstadoPublicacion> = {
  "Esperando foto": "ESPERANDO_FOTO",
  Pendiente: "PENDIENTE",
  Aprobado: "APROBADO",
  Denegado: "DENEGADO",
};

// POST /api/admin/clientes-contenido/<slug>/importar-planilla?key=...
//
// Migración de una sola vez (idempotente — se puede correr de nuevo sin
// duplicar filas, hace upsert por clienteSlug+fecha+hora): lee el Google
// Sheet que tiene configurado este cliente en planillaSheetId/planillaGid y
// vuelca cada fila a la tabla Publicacion. Pensado para clientes que
// vienen de la planilla vieja (ej. Romina) y se quieren pasar a la base
// propia sin re-tipear las filas a mano — ver
// agencia/decision-cron-avisos-fotos-pendientes.md, sección "de Sheets a
// base propia".
//
// Después de correr esto y confirmar en /admin/contenido/<slug> que se ve
// bien, el paso manual que queda es sacarle planillaSheetId a la config
// (POST /api/admin/clientes-contenido con planillaSheetId: null) para que
// el cron de avisos y el resto de la app dejen de mirar el Sheet — recién
// ahí "se elimina la planilla" de verdad del flujo operativo (el archivo de
// Google puede seguir existiendo como respaldo histórico, simplemente deja
// de ser la fuente de verdad).
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const config = await prisma.clienteContenidoConfig.findUnique({ where: { slug: params.slug } });
  if (!config) return NextResponse.json({ error: `No hay ningún cliente con slug ${params.slug}` }, { status: 404 });
  if (!config.planillaSheetId) {
    return NextResponse.json({ error: "Este cliente no tiene planillaSheetId configurado — no hay nada para importar" }, { status: 400 });
  }

  const filas = await fetchFilasPlanilla(config.planillaSheetId, config.planillaGid);

  let importadas = 0;
  let actualizadas = 0;
  const saltadas: { fecha: string; hora: string; motivo: string }[] = [];

  for (const fila of filas) {
    const fecha = parseFechaPlanilla(fila.Fecha);
    if (!fecha || !fila.Hora) {
      saltadas.push({ fecha: fila.Fecha, hora: fila.Hora, motivo: "Fecha u Hora incompleta" });
      continue;
    }

    const estado = ESTADO_PLANILLA_A_ENUM[fila.Estado];
    if (!estado) {
      saltadas.push({ fecha: fila.Fecha, hora: fila.Hora, motivo: `Estado desconocido: "${fila.Estado}"` });
      continue;
    }

    const existente = await prisma.publicacion.findUnique({
      where: { clienteSlug_fecha_hora: { clienteSlug: params.slug, fecha, hora: fila.Hora } },
    });

    await prisma.publicacion.upsert({
      where: { clienteSlug_fecha_hora: { clienteSlug: params.slug, fecha, hora: fila.Hora } },
      create: {
        clienteSlug: params.slug,
        fecha,
        hora: fila.Hora,
        texto: fila.Texto,
        linkImagen: fila.Link_Imagen || null,
        estado,
        publicado: fila.Publicado?.toLowerCase() === "si",
        archivo: fila.Archivo || null,
        observacion: fila.Observacion || null,
        linkDrive: fila.Link_Drive || null,
        tema: fila.Tema || null,
      },
      update: {
        texto: fila.Texto,
        linkImagen: fila.Link_Imagen || null,
        estado,
        publicado: fila.Publicado?.toLowerCase() === "si",
        archivo: fila.Archivo || null,
        observacion: fila.Observacion || null,
        linkDrive: fila.Link_Drive || null,
        tema: fila.Tema || null,
      },
    });

    if (existente) actualizadas++;
    else importadas++;
  }

  return NextResponse.json({ importadas, actualizadas, saltadas, totalFilasLeidas: filas.length });
}
