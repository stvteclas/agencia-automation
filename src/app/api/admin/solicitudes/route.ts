import { NextRequest, NextResponse } from "next/server";
import { listarSolicitudes } from "@/lib/solicitudes";
import type { EstadoSolicitud } from "@prisma/client";

function autorizado(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

// GET /api/admin/solicitudes?estado=NUEVA
// Pensado para la revisión diaria programada: trae lo pendiente en vez de
// tener que leer un Google Form.
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const estado = req.nextUrl.searchParams.get("estado") as EstadoSolicitud | null;
  const solicitudes = await listarSolicitudes(estado ?? undefined);
  return NextResponse.json({ solicitudes });
}
