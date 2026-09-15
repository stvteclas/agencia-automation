import { NextRequest, NextResponse } from "next/server";
import { PLANTILLA_AVISO_FOTO } from "@/lib/whatsapp";

const GRAPH_VERSION = "v20.0";

function autorizado(req: NextRequest) {
  const clave = process.env.ADMIN_API_KEY;
  if (!clave) return false;
  return req.headers.get("x-admin-key") === clave || req.nextUrl.searchParams.get("key") === clave;
}

// El número de WhatsApp de la agencia vive bajo una WABA (WhatsApp Business
// Account) — las plantillas se crean/listan a nivel de esa cuenta, no del
// número. Se resuelve dinámicamente a partir de WHATSAPP_PHONE_NUMBER_ID en
// vez de guardar un id más en el .env.
async function obtenerWabaId(token: string, phoneNumberId: string): Promise<string> {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}?fields=whatsapp_business_account`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`No se pudo resolver la WABA: ${JSON.stringify(data)}`);
  const wabaId = data.whatsapp_business_account?.id;
  if (!wabaId) throw new Error(`Respuesta sin whatsapp_business_account: ${JSON.stringify(data)}`);
  return wabaId;
}

// GET /api/admin/whatsapp-templates?key=...
// Lista las plantillas ya creadas en la WABA de la agencia, con su estado
// de aprobación (PENDING / APPROVED / REJECTED).
//
// GET /api/admin/whatsapp-templates?crear=true&key=...
// Da de alta (una sola vez) la plantilla "aviso_foto_pendiente", que
// reemplaza al texto libre para el aviso de "falta esta foto" — necesaria
// porque Meta exige una plantilla aprobada para que la agencia le escriba
// primero a un cliente que no le escribió en las últimas 24hs (motivo real
// de que los 3 avisos de prueba a Romina nunca le llegaran, 15/09/2026).
// Genérica para cualquier cliente futuro, no específica de Romina. Ver
// agencia/decision-cron-avisos-fotos-pendientes.md.
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return NextResponse.json({ error: "Faltan WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID" }, { status: 500 });
  }

  try {
    const wabaId = await obtenerWabaId(token, phoneNumberId);

    if (req.nextUrl.searchParams.get("crear") === "true") {
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: PLANTILLA_AVISO_FOTO.nombre,
          language: PLANTILLA_AVISO_FOTO.idioma,
          category: "UTILITY",
          components: [
            {
              type: "BODY",
              text: 'Hola {{1}}! Nos falta la foto para la publicación del {{2}}. Cuando la mandes, te vamos a preguntar para qué publicación es — respondé exactamente "{{3}}" para que quede bien identificada. Gracias!',
              example: {
                body_text: [["Romina", "15/09", "masajes 15/09"]],
              },
            },
          ],
        }),
      });
      const data = await res.json();
      return NextResponse.json({ wabaId, creado: res.ok, respuestaMeta: data }, { status: res.ok ? 200 : 502 });
    }

    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return NextResponse.json({ wabaId, plantillas: data.data ?? data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
