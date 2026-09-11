import { NextRequest, NextResponse } from "next/server";
import { obtenerSolicitud, resolverSolicitud, actualizarEstado, marcarAplicadaEnPlanilla } from "@/lib/solicitudes";
import type { EstadoSolicitud } from "@prisma/client";

// Acepta también `key` por query string, mismo motivo que
// /api/admin/solicitudes (route.ts): la revisión diaria a veces solo puede
// navegar con el browser vinculado a la PC de Pablo, sin headers custom.
function autorizado(req: NextRequest) {
  const clave = process.env.ADMIN_API_KEY;
  if (!clave) return false;
  return req.headers.get("x-admin-key") === clave || req.nextUrl.searchParams.get("key") === clave;
}

// GET normal: trae el detalle. Con ?aplicado=true (side-effect a propósito,
// mismo patrón que los webhooks de Make que se disparan navegando una URL
// con el browser vinculado a la PC de Pablo, sin poder mandar un PATCH con
// body): marca la Solicitud como aplicada en la planilla, para que la
// revisión diaria no la vuelva a traer en la próxima consulta de
// ?tipo=APROBACION_PUBLICACION&estado=RESUELTA&aplicado=false.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (req.nextUrl.searchParams.get("aplicado") === "true") {
    const solicitud = await marcarAplicadaEnPlanilla(params.id);
    return NextResponse.json({ solicitud });
  }

  const solicitud = await obtenerSolicitud(params.id);
  if (!solicitud) return NextResponse.json({ error: "No existe" }, { status: 404 });
  return NextResponse.json({ solicitud });
}

// Body: { estado?: "EN_PROCESO" | "RESUELTA", detalleResolucion?: string, notaInterna?: string }
// Si estado="RESUELTA" y viene detalleResolucion, el cliente recibe ese
// texto por WhatsApp automáticamente (ver src/lib/solicitudes.ts).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const estado = body.estado as EstadoSolicitud | undefined;

  const solicitud =
    estado === "RESUELTA"
      ? await resolverSolicitud(params.id, body.detalleResolucion, body.notaInterna)
      : await actualizarEstado(params.id, estado ?? "EN_PROCESO", body.notaInterna);

  return NextResponse.json({ solicitud });
}
