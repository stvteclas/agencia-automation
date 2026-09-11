import { NextRequest, NextResponse } from "next/server";
import { listarSolicitudes } from "@/lib/solicitudes";
import type { EstadoSolicitud } from "@prisma/client";

function autorizado(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

// GET /api/admin/solicitudes?estado=NUEVA&telefono=5493543318665
// Pensado para la revisión diaria programada de cada cliente: trae lo
// pendiente de ESE cliente en vez de tener que leer un Google Form. El
// filtro `telefono` es opcional — sin él, devuelve de todos los clientes
// (uso del panel /admin y de la revisión general de la agencia).
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const estado = req.nextUrl.searchParams.get("estado") as EstadoSolicitud | null;
  const telefono = req.nextUrl.searchParams.get("telefono");
  const solicitudes = await listarSolicitudes(estado ?? undefined, telefono ?? undefined);
  return NextResponse.json({ solicitudes });
}
