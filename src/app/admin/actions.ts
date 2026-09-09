"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolverSolicitud, actualizarEstado } from "@/lib/solicitudes";
import { ADMIN_COOKIE } from "@/lib/admin-auth";

export async function login(formData: FormData) {
  const clave = String(formData.get("clave") ?? "");
  if (clave && clave === process.env.ADMIN_API_KEY) {
    cookies().set(ADMIN_COOKIE, clave, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  }
  redirect("/admin");
}

export async function cerrarSesion() {
  cookies().delete(ADMIN_COOKIE);
  redirect("/admin");
}

export async function marcarEnProceso(id: string) {
  await actualizarEstado(id, "EN_PROCESO");
  redirect(`/admin/${id}`);
}

export async function marcarResuelta(id: string, formData: FormData) {
  const detalle = String(formData.get("detalle") ?? "").trim();
  const nota = String(formData.get("nota") ?? "").trim();
  await resolverSolicitud(id, detalle || undefined, nota || undefined);
  redirect("/admin");
}
