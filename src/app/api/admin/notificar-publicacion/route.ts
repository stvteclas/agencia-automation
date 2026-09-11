import { NextRequest, NextResponse } from "next/server";
import { crearAprobacionPublicacion, buscarAprobacionPendiente } from "@/lib/solicitudes";
import { buscarClientePorTelefono } from "@/lib/clientes";

// Acepta la clave por header o por query string (`?key=...`) — la revisión
// diaria dispara esto navegando con el browser vinculado a la PC de Pablo,
// igual que los webhooks de Make de cada cliente (no puede mandar headers
// custom desde una navegación simple).
function autorizado(req: NextRequest) {
  const clave = process.env.ADMIN_API_KEY;
  if (!clave) return false;
  return req.headers.get("x-admin-key") === clave || req.nextUrl.searchParams.get("key") === clave;
}

// GET /api/admin/notificar-publicacion?telefono=...&archivo=...&link=...&key=...
//
// Lo llama la revisión diaria (Skill revision-diaria-community-manager-ia)
// por cada fila de la planilla que queda lista para revisar
// (Estado=Pendiente, Fecha/Hora/Texto/Link_Drive completos) y todavía no fue
// notificada. Crea la Solicitud de aprobación y le manda al cliente el link
// por WhatsApp. Es la misma fila la que se reintenta sola en la próxima
// revisión diaria si el cliente pidió cambios y la pieza corregida vuelve a
// entrar como una fila Pendiente nueva — no hace falta lógica de reintento
// acá (ver agencia/decision-bot-aprobacion-publicaciones.md, "Ciclo de
// corrección").
//
// Idempotente: si ya hay una APROBACION_PUBLICACION sin responder para este
// mismo teléfono y archivo, no manda un segundo WhatsApp — devuelve la que
// ya existía. Evita duplicar el aviso si la revisión diaria se dispara dos
// veces por error para la misma fila.
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const telefono = req.nextUrl.searchParams.get("telefono");
  const archivo = req.nextUrl.searchParams.get("archivo");
  const link = req.nextUrl.searchParams.get("link");
  const nombreNegocio = req.nextUrl.searchParams.get("nombreNegocio") ?? undefined;

  if (!telefono || !archivo || !link) {
    return NextResponse.json({ error: "Faltan parámetros: telefono, archivo y link son obligatorios" }, { status: 400 });
  }

  const cliente = await buscarClientePorTelefono(telefono);
  if (!cliente) {
    return NextResponse.json(
      { error: `No hay ningún Cliente registrado con el teléfono ${telefono} — hay que cargarlo antes (ver plan-bot-atencion-agencia.md, sección "Cliente conocido").` },
      { status: 404 },
    );
  }

  const pendiente = await buscarAprobacionPendiente(telefono);
  if (pendiente && pendiente.archivo === archivo) {
    return NextResponse.json({ solicitud: pendiente, yaExistia: true });
  }

  const solicitud = await crearAprobacionPublicacion({
    telefono,
    archivo,
    linkPreview: link,
    nombreNegocio: nombreNegocio ?? cliente.nombre,
  });

  return NextResponse.json({ solicitud, yaExistia: false });
}
