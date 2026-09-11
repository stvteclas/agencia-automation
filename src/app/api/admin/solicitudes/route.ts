import { NextRequest, NextResponse } from "next/server";
import { listarSolicitudes } from "@/lib/solicitudes";
import type { EstadoSolicitud } from "@prisma/client";

// Acepta la clave por header (`x-admin-key`, uso normal de API) o por query
// string (`?key=...`), porque las rutinas programadas de revisión diaria a
// veces solo pueden navegar a una URL con el navegador vinculado a la PC de
// Pablo (sin poder mandar headers custom) — mismo patrón que ya usan los
// webhooks de Make de cada cliente.
function autorizado(req: NextRequest) {
  const clave = process.env.ADMIN_API_KEY;
  if (!clave) return false;
  return req.headers.get("x-admin-key") === clave || req.nextUrl.searchParams.get("key") === clave;
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
