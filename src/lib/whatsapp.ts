// Envío de mensajes de texto vía WhatsApp Cloud API. Igual patrón que el
// bot de turnos-app: token permanente + phone_number_id de Meta.

const GRAPH_VERSION = "v20.0";

function graphUrl(path: string) {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${path}`;
}

// Devuelve si el envío realmente se aceptó del lado de Meta — antes esta
// función no devolvía nada y solo hacía console.error en caso de error, así
// que quien la llamaba (ej. el cron de avisos) no tenía forma de saber que
// el mensaje no salió y seguía de largo como si hubiera salido bien (bug
// encontrado 15/09/2026: Romina nunca recibió los 3 avisos de prueba, pero
// quedaron marcados como enviados en AvisoFotoPendiente porque esto no tiraba
// error). Ver agencia/decision-cron-avisos-fotos-pendientes.md.
export async function sendWhatsappText(
  to: string,
  body: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneNumberId || !token) {
    const msg = "Faltan WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_TOKEN en el .env";
    console.error(msg);
    return { ok: false, error: msg };
  }

  const res = await fetch(graphUrl(`${phoneNumberId}/messages`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("Error enviando WhatsApp:", res.status, detail);
    return { ok: false, status: res.status, error: detail };
  }

  return { ok: true, status: res.status };
}

// Estructura mínima de lo que manda Meta al webhook para un mensaje de
// texto entrante. Se tipa a mano (no vale la pena instalar el SDK
// completo de Meta para esto).
export type WhatsappInboundMessage = {
  from: string; // teléfono en formato internacional sin "+"
  text: string; // cuerpo del mensaje, ya en minúscula/trim en el caller
};

export function extractInboundMessages(body: any): WhatsappInboundMessage[] {
  const messages: WhatsappInboundMessage[] = [];
  const entries = body?.entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue; // ignora smb_message_echoes, statuses, etc.
      const value = change.value ?? {};
      for (const msg of value.messages ?? []) {
        if (msg.type === "text" && msg.text?.body) {
          messages.push({ from: msg.from, text: msg.text.body.trim() });
        } else if (msg.type === "interactive" && msg.interactive?.button_reply) {
          messages.push({ from: msg.from, text: msg.interactive.button_reply.title.trim() });
        }
      }
    }
  }
  return messages;
}
