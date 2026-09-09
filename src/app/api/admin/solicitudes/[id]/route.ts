import { NextRequest, NextResponse } from "next/server";
import { obtenerSolicitud, resolverSolicitud, actualizarEstado } from "@/lib/solicitudes";
import type { EstadoSolicitud } from "@prisma/client";

function autorizado(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
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
