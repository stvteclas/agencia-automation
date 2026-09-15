// Envío de mensajes de texto vía WhatsApp Cloud API. Igual patrón que el
// bot de turnos-app: token permanente + phone_number_id de Meta.

const GRAPH_VERSION = "v20.0";

function graphUrl(path: string) {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${path}`;
}

// Nombre e idioma de la plantilla que reemplaza al texto libre para los
// avisos "falta esta foto" — Meta exige una plantilla aprobada para que la
// agencia le escriba primero a un cliente que no le escribió a ella en las
// últimas 24hs (si no, el texto libre lo rechaza — el bug real detrás de que
// los 3 avisos de Romina nunca le llegaran, 15/09/2026). Ver
// agencia/decision-cron-avisos-fotos-pendientes.md.
export const PLANTILLA_AVISO_FOTO = { nombre: "aviso_foto_pendiente", idioma: "es_AR" };

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
): Promise<{ ok: boolean; status?: number; error?: string; respuesta?: string }> {
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

  const detail = await res.text();

  if (!res.ok) {
    console.error("Error enviando WhatsApp:", res.status, detail);
    return { ok: false, status: res.status, error: detail };
  }

  // 15/09/2026: devolvemos el body crudo (message id de Meta) también en el
  // caso exitoso — un 200 con id no siempre significó entrega real (ver
  // agencia/decision-cron-avisos-fotos-pendientes.md), así que este dato
  // queda expuesto en el cron para diagnosticar sin tener que adivinar.
  return { ok: true, status: res.status, respuesta: detail };
}

// Manda un mensaje de plantilla (HSM) aprobada por Meta — a diferencia de
// sendWhatsappText, esto SÍ funciona aunque el cliente nunca le haya
// escrito a la agencia o hayan pasado más de 24hs desde su último mensaje.
// `params` va posicional, uno por cada {{n}} del body de la plantilla en
// Meta (ver PLANTILLA_AVISO_FOTO / /api/admin/whatsapp-templates).
export async function sendWhatsappTemplate(
  to: string,
  nombrePlantilla: string,
  idioma: string,
  params: string[],
): Promise<{ ok: boolean; status?: number; error?: string; respuesta?: string }> {
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
      type: "template",
      template: {
        name: nombrePlantilla,
        language: { code: idioma },
        components: [
          {
            type: "body",
            parameters: params.map((texto) => ({ type: "text", text: texto })),
          },
        ],
      },
    }),
  });

  const detail = await res.text();

  if (!res.ok) {
    console.error("Error enviando plantilla de WhatsApp:", res.status, detail);
    return { ok: false, status: res.status, error: detail };
  }

  return { ok: true, status: res.status, respuesta: detail };
}

// Envío del aviso "falta esta foto": intenta primero la plantilla aprobada
// (funciona aunque el cliente nunca le haya escrito a la agencia o hayan
// pasado más de 24hs desde su último mensaje — el caso real que hizo que
// los 3 avisos de prueba a Romina nunca le llegaran, 15/09/2026) y, si la
// plantilla todavía no existe o no fue aprobada por Meta (`ok:false`), cae a
// texto libre — que sigue funcionando para el cliente que sí escribió hace
// poco. Ver /api/admin/whatsapp-templates y
// agencia/decision-cron-avisos-fotos-pendientes.md.
export async function enviarAvisoFotoPendiente(
  telefono: string,
  primerNombre: string,
  fechaCorta: string,
  titulo: string,
  mensajeTextoLibre: string,
): Promise<{ ok: boolean; status?: number; error?: string; respuesta?: string; via: "plantilla" | "texto_libre" }> {
  const porPlantilla = await sendWhatsappTemplate(telefono, PLANTILLA_AVISO_FOTO.nombre, PLANTILLA_AVISO_FOTO.idioma, [
    primerNombre,
    fechaCorta,
    titulo,
  ]);
  if (porPlantilla.ok) return { ...porPlantilla, via: "plantilla" };

  const porTexto = await sendWhatsappText(telefono, mensajeTextoLibre);
  return { ...porTexto, via: "texto_libre" };
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
