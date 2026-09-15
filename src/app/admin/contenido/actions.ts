"use server";

import { redirect } from "next/navigation";
import { cambiarEstadoPublicacion } from "@/lib/publicaciones";
import type { EstadoPublicacion } from "@prisma/client";

// Única acción que puede tocar Estado desde el dashboard — la misma regla
// de oro que regía sobre la columna Estado de la planilla vieja
// (cursor-rules/revision-diaria.mdc, paso 7): esto lo hace Pablo a mano
// desde /admin/contenido/[slug], nunca un cron ni un agente por su cuenta.
export async function cambiarEstado(formData: FormData) {
  const id = String(formData.get("id"));
  const slug = String(formData.get("slug"));
  const estado = String(formData.get("estado")) as EstadoPublicacion;

  await cambiarEstadoPublicacion(id, estado);
  redirect(`/admin/contenido/${slug}`);
}
