import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function autorizado(req: NextRequest) {
  const clave = process.env.ADMIN_API_KEY;
  if (!clave) return false;
  return req.headers.get("x-admin-key") === clave || req.nextUrl.searchParams.get("key") === clave;
}

// GET /api/admin/avisos-fotos-pendientes?clienteSlug=...&key=...
// Lista los avisos ya registrados para un cliente (para ver qué quedó
// marcado como "ya avisado" en AvisoFotoPendiente).
//
// GET /api/admin/avisos-fotos-pendientes?clienteSlug=...&fecha=...&hora=...&eliminar=true&key=...
// Borra un registro puntual — para cuando el WhatsApp real nunca llegó (el
// bug del 15/09/2026: sendWhatsappText no tiraba error si Meta rechazaba el
// envío, así que 3 avisos de Romina quedaron marcados como enviados sin
// haber salido nunca). Borrando el registro, el cron vuelve a intentarlo la
// próxima corrida. Ver agencia/decision-cron-avisos-fotos-pendientes.md.
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const clienteSlug = req.nextUrl.searchParams.get("clienteSlug");
  if (!clienteSlug) {
    return NextResponse.json({ error: "Falta clienteSlug" }, { status: 400 });
  }

  if (req.nextUrl.searchParams.get("eliminar") === "true") {
    const fecha = req.nextUrl.searchParams.get("fecha");
    const hora = req.nextUrl.searchParams.get("hora");
    if (!fecha || !hora) {
      return NextResponse.json({ error: "Para eliminar hacen falta fecha y hora" }, { status: 400 });
    }

    const eliminado = await prisma.avisoFotoPendiente.deleteMany({
      where: { clienteSlug, fecha, hora },
    });
    return NextResponse.json({ eliminados: eliminado.count });
  }

  const avisos = await prisma.avisoFotoPendiente.findMany({
    where: { clienteSlug },
    orderBy: [{ fecha: "asc" }, { hora: "asc" }],
  });
  return NextResponse.json({ avisos });
}
