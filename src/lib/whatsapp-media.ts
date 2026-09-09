import { put } from "@vercel/blob";

const GRAPH_VERSION = "v20.0";

// Un mensaje entrante de imagen trae solo un media id — hay que resolverlo a
// una URL temporal (Meta la vence rápido) y bajarla ya mismo con el mismo
// token, para después subirla a un storage propio y quedarnos con una URL
// estable. Mismo patrón que ya usa turnos-app para fotos de comprobantes.
export async function descargarImagenDeWhatsapp(mediaId: string): Promise<Buffer> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) throw new Error("Falta WHATSAPP_TOKEN");

  const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) throw new Error(`No se pudo resolver el media id ${mediaId}: ${metaRes.status}`);
  const { url } = (await metaRes.json()) as { url: string };

  const fileRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!fileRes.ok) throw new Error(`No se pudo descargar la imagen: ${fileRes.status}`);
  return Buffer.from(await fileRes.arrayBuffer());
}

export async function guardarLogoEnBlob(telefono: string, campo: string, bytes: Buffer, extension = "jpg") {
  const blob = await put(`logos/${telefono}-${campo}-${Date.now()}.${extension}`, bytes, {
    access: "public",
  });
  return blob.url;
}

// Estructura mínima de un mensaje de imagen entrante de Meta.
export type WhatsappInboundImage = { from: string; mediaId: string; mimeType?: string };

export function extractInboundImages(body: any): WhatsappInboundImage[] {
  const imagenes: WhatsappInboundImage[] = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      for (const msg of change.value?.messages ?? []) {
        if (msg.type === "image" && msg.image?.id) {
          imagenes.push({ from: msg.from, mediaId: msg.image.id, mimeType: msg.image.mime_type });
        }
      }
    }
  }
  return imagenes;
}
