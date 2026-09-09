import { cookies } from "next/headers";

// Helper simple, NO es un archivo "use server" — se puede llamar
// sincrónicamente desde un Server Component (page.tsx) sin que Next.js lo
// confunda con una server action (esas tienen que ser todas async).
export const ADMIN_COOKIE = "admin_key";

export function estaAutenticado() {
  return cookies().get(ADMIN_COOKIE)?.value === process.env.ADMIN_API_KEY;
}
