import { NextRequest, NextResponse } from "next/server";
import { listarPendientesDePublicarHoy, crearPublicacion } from "@/lib/publicaciones";
import { hoyArgentina } from "@/lib/planilla-contenido";

function autorizado(req: NextRequest) {
  const clave = process.env.ADMIN_API_KEY;
  if (!clave) return false;
  return req.headers.get("x-admin-key") === clave || req.nextUrl.searchParams.get("key") === clave;
}

// GET /api/admin/publicaciones?pendientesHoy=true&key=...[&slug=...]
//
// Lo que antes leía directo el módulo de Google Sheets de la ruta
// `publicar_calendario` en Make (Estado=Aprobado AND Publicado vacío AND
// Fecha=hoy). Para un cliente ya migrado a Publicacion, Make (o el cron
// propio que la reemplace, ver agencia/decision-cron-avisos-fotos-pendientes.md)
// pega esto en vez de al Google Sheet. `slug` es opcional — sin él, trae de
// todos los clientes.
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (req.nextUrl.searchParams.get("pendientesHoy") === "true") {
    const slug = req.nextUrl.searchParams.get("slug") ?? undefined;
    const publicaciones = await listarPendientesDePublicarHoy(hoyArgentina(), slug);
    return NextResponse.json({ publicaciones });
  }

  return NextResponse.json({ error: "Falta ?pendientesHoy=true (por ahora es el único filtro soportado acá)" }, { status: 400 });
}

// POST /api/admin/publicaciones?key=...
// Body: { clienteSlug, fecha (ISO), hora, texto, linkImagen?, estado?, archivo?, observacion?, linkDrive?, tema? }
// Carga una fila nueva directo en la base — reemplazo de `agregar_completo`
// para un cliente que ya no usa Sheets.
export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });

  const { clienteSlug, fecha, hora, texto } = body;
  if (!clienteSlug || !fecha || !hora || !texto) {
    return NextResponse.json({ error: "Faltan campos obligatorios: clienteSlug, fecha, hora, texto" }, { status: 400 });
  }

  const publicacion = await crearPublicacion({
    clienteSlug,
    fecha: new Date(fecha),
    hora,
    texto,
    linkImagen: body.linkImagen,
    estado: body.estado,
    archivo: body.archivo,
    observacion: body.observacion,
    linkDrive: body.linkDrive,
    tema: body.tema,
  });

  return NextResponse.json({ publicacion });
}
