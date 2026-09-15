import { NextRequest, NextResponse } from "next/server";
import { obtenerPublicacion, cambiarEstadoPublicacion, marcarPublicada, actualizarPublicacion } from "@/lib/publicaciones";
import type { EstadoPublicacion } from "@prisma/client";

function autorizado(req: NextRequest) {
  const clave = process.env.ADMIN_API_KEY;
  if (!clave) return false;
  return req.headers.get("x-admin-key") === clave || req.nextUrl.searchParams.get("key") === clave;
}

// GET normal: trae el detalle. Con ?marcarPublicado=true (mismo patrón de
// GET-con-side-effect que /api/admin/solicitudes/[id] y
// /api/admin/avisar-foto-pendiente, para que Make pueda disparar esto
// navegando una URL sin mandar body): marca `publicado=true`, reemplazo del
// módulo "Google Sheets — Update a Row: Publicado=si" de la ruta
// `publicar_calendario`.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (req.nextUrl.searchParams.get("marcarPublicado") === "true") {
    const publicacion = await marcarPublicada(params.id);
    return NextResponse.json({ publicacion });
  }

  const publicacion = await obtenerPublicacion(params.id);
  if (!publicacion) return NextResponse.json({ error: "No existe" }, { status: 404 });
  return NextResponse.json({ publicacion });
}

// PATCH — usado por el dashboard /admin/contenido/[slug] (server action) y
// por cualquier llamada admin que necesite cambiar Estado u otros campos.
// Body: { estado?: EstadoPublicacion, ...resto de campos editables }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });

  if (body.estado) {
    await cambiarEstadoPublicacion(params.id, body.estado as EstadoPublicacion);
  }

  const { estado, ...resto } = body;
  const hayOtrosCambios = Object.keys(resto).length > 0;
  const publicacion = hayOtrosCambios
    ? await actualizarPublicacion(params.id, {
        ...resto,
        ...(resto.fecha ? { fecha: new Date(resto.fecha) } : {}),
      })
    : await obtenerPublicacion(params.id);

  return NextResponse.json({ publicacion });
}
