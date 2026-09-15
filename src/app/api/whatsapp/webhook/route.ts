import { NextRequest, NextResponse } from "next/server";
import { extractInboundMessages } from "@/lib/whatsapp";
import { extractInboundImages } from "@/lib/whatsapp-media";
import { manejarMensajeEntrante, manejarImagenEntrante } from "@/lib/conversation";

// Verificación del webhook (Meta la llama una sola vez al configurarlo).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// Mensajes entrantes. Responder rápido (200) es importante: Meta reintenta
// si no contesta a tiempo, y no hace falta que el procesamiento termine
// antes de responder — pero para simplicidad acá se espera igual, el
// volumen de este bot no justifica una cola aparte.
export async function POST(req: NextRequest) {
  const body = await req.json();

  // Diagnóstico 15/09/2026: Meta manda acá el estado real de entrega
  // (sent/delivered/read/failed) de cada mensaje que mandamos, pero
  // extractInboundMessages solo mira field=messages e ignora field=statuses
  // en silencio — así que un mensaje que Meta aceptó (200 al mandarlo) y
  // después falló de verdad nunca se veía en ningún lado. Se loggea acá
  // temporalmente para diagnosticar por qué los avisos de foto pendiente no
  // le llegaban a Romina aunque el envío devolvía 200. Ver
  // agencia/decision-cron-avisos-fotos-pendientes.md.
  try {
    for (const entry of body?.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const estados = change.value?.statuses;
        if (Array.isArray(estados)) {
          for (const estado of estados) {
            console.log(
              "WHATSAPP_STATUS:",
              JSON.stringify({
                wamid: estado.id,
                to: estado.recipient_id,
                status: estado.status,
                timestamp: estado.timestamp,
                errors: estado.errors,
              }),
            );
          }
        }
      }
    }
  } catch (err) {
    console.error("Error logueando estados de WhatsApp:", err);
  }

  try {
    for (const msg of extractInboundMessages(body)) {
      await manejarMensajeEntrante(msg.from, msg.text);
    }
    for (const img of extractInboundImages(body)) {
      await manejarImagenEntrante(img.from, img.mediaId);
    }
  } catch (err) {
    // No relanzar: aunque falle el procesamiento, hay que devolver 200 para
    // que Meta no reintente en loop el mismo mensaje.
    console.error("Error procesando webhook de WhatsApp:", err);
  }

  return NextResponse.json({ ok: true });
}
