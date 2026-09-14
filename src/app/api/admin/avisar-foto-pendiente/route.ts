import { NextRequest, NextResponse } from "next/server";
import { sendWhatsappText } from "@/lib/whatsapp";
import { buscarClientePorTelefono } from "@/lib/clientes";

// Mismo esquema de autorización que notificar-publicacion (header
// x-admin-key o ?key=... — la revisión diaria dispara esto navegando con el
// browser vinculado a la PC de Pablo, no puede mandar headers custom desde
// una navegación simple).
function autorizado(req: NextRequest) {
  const clave = process.env.ADMIN_API_KEY;
  if (!clave) return false;
  return req.headers.get("x-admin-key") === clave || req.nextUrl.searchParams.get("key") === clave;
}

// GET /api/admin/avisar-foto-pendiente?telefono=...&mensaje=...&key=...
//
// Le manda al cliente, con el número del bot de la agencia, un WhatsApp
// pidiéndole una foto puntual que falta para el circuito de "publicación
// directa" (agencia/decision-circuito-publicacion-directa.md, paso 0.ter de
// revision-diaria.mdc). Existe como endpoint — en vez de resolverse con un
// script node local — porque WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID son las
// credenciales reales de Meta y solo están cargadas en el entorno de Vercel
// (deploy), no en el .env local de la PC de Pablo. Corriendo esto contra
// `https://agencia-automation.vercel.app/...` se manda con las credenciales
// de verdad sin tener que copiarlas a ningún lado.
//
// No crea ninguna Solicitud ni toca la planilla — es solo el aviso. El
// emparejamiento sigue pasando por el flujo normal cuando la clienta
// responda con la foto.
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const telefono = req.nextUrl.searchParams.get("telefono");
  const mensaje = req.nextUrl.searchParams.get("mensaje");

  if (!telefono || !mensaje) {
    return NextResponse.json({ error: "Faltan parámetros: telefono y mensaje son obligatorios" }, { status: 400 });
  }

  const cliente = await buscarClientePorTelefono(telefono);
  if (!cliente) {
    return NextResponse.json(
      { error: `No hay ningún Cliente registrado con el teléfono ${telefono} — hay que cargarlo antes.` },
      { status: 404 },
    );
  }

  await sendWhatsappText(telefono, mensaje);

  return NextResponse.json({ enviado: true, telefono });
}
