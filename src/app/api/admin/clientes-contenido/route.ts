import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Alta/edición/baja de clientes en el cron de avisos de foto pendiente
// (agencia/decision-cron-avisos-fotos-pendientes.md) — para que sumar un
// cliente nuevo sea un curl, no un cambio de código ni un INSERT a mano en
// Neon. Mismo esquema de auth que el resto de /api/admin/* (header
// x-admin-key o ?key=...).
function autorizado(req: NextRequest) {
  const clave = process.env.ADMIN_API_KEY;
  if (!clave) return false;
  return req.headers.get("x-admin-key") === clave || req.nextUrl.searchParams.get("key") === clave;
}

// GET /api/admin/clientes-contenido?key=...
// Lista todos los clientes configurados (activos e inactivos).
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const clientes = await prisma.clienteContenidoConfig.findMany({ orderBy: { creadoEn: "asc" } });
  return NextResponse.json({ clientes });
}

// POST /api/admin/clientes-contenido?key=...
// Body JSON: { slug, nombre, planillaSheetId, planillaGid?, ventanaAvisoDias?, telefonoAviso, activo? }
//
// Upsert por slug — correr esto de nuevo con el mismo slug actualiza la
// config existente (ej. para cambiar telefonoAviso o desactivar un cliente
// con activo:false) en vez de crear una fila duplicada.
//
// Ejemplo:
//   curl -X POST "https://agencia-automation.vercel.app/api/admin/clientes-contenido?key=$ADMIN_API_KEY" \
//     -H "Content-Type: application/json" \
//     -d '{
//       "slug": "romina-balquinta",
//       "nombre": "Romina Balquinta",
//       "planillaSheetId": "1mjbTAsqLFJfMxQFkWDWrseR1FX8jnw1VjFs88cMsq8A",
//       "planillaGid": "0",
//       "ventanaAvisoDias": 5,
//       "telefonoAviso": "5493515733863"
//     }'
export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });

  const { slug, nombre, planillaSheetId, planillaGid, ventanaAvisoDias, telefonoAviso, activo } = body;

  if (!slug || !nombre || !planillaSheetId || !telefonoAviso) {
    return NextResponse.json(
      { error: "Faltan campos obligatorios: slug, nombre, planillaSheetId, telefonoAviso" },
      { status: 400 },
    );
  }

  const cliente = await prisma.clienteContenidoConfig.upsert({
    where: { slug },
    create: {
      slug,
      nombre,
      planillaSheetId,
      planillaGid: planillaGid ?? "0",
      ventanaAvisoDias: ventanaAvisoDias ?? 5,
      telefonoAviso,
      activo: activo ?? true,
    },
    update: {
      nombre,
      planillaSheetId,
      ...(planillaGid !== undefined ? { planillaGid } : {}),
      ...(ventanaAvisoDias !== undefined ? { ventanaAvisoDias } : {}),
      telefonoAviso,
      ...(activo !== undefined ? { activo } : {}),
    },
  });

  return NextResponse.json({ cliente });
}
