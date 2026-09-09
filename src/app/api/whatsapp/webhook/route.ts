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
