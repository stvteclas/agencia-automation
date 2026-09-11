// Cuestionario para el pedido de una invitación digital de evento (XV años,
// casamiento, cumpleaños, etc.) — rubro nuevo, validado a partir del sitio
// quince-de-sofia.vercel.app. Mismo mecanismo que preguntas-alta-cliente.ts:
// el motor de conversación (conversation.ts) lo recorre pregunta por
// pregunta y guarda una respuesta por id en Solicitud.respuestas (JSON).
//
// A diferencia del alta de Community Manager IA (servicio recurrente), esto
// es una venta única — el cuestionario es más corto y termina con el plan
// elegido y la confirmación de pago único, no con un alta de Cliente.
//
// Ver agencia/rubro-invitaciones-digitales-eventos.md (base de conocimiento
// del proyecto) para el análisis comercial y el detalle de cada pregunta.
// Si se ajustan preguntas o precios acá, reflejar el cambio también ahí.

import type { Respuestas, PreguntaAltaCliente } from "./preguntas-alta-cliente";

export type { Respuestas };
export type PreguntaInvitacionDigital = PreguntaAltaCliente;

export const PREGUNTAS_INVITACION_DIGITAL: PreguntaInvitacionDigital[] = [
  // Datos del evento
  {
    id: "tipo_evento",
    texto: "¡Buenísimo! 🎉 Para arrancar: ¿qué tipo de evento es? (XV años, casamiento, cumpleaños, otro)",
  },
  {
    id: "nombre_festejado",
    texto: (r) => `¿Cómo se llama${/casamiento|boda/i.test(r.tipo_evento ?? "") ? "n" : ""} el/la festejado/a (o los novios)?`,
  },
  {
    id: "fecha_evento",
    texto: (r) => `Dale, ${r.nombre_festejado} 🥳 ¿Qué fecha y horario tiene el evento? (ej. sábado 28 de noviembre de 2026, 21:00 a 04:00 hs)`,
  },
  {
    id: "lugar_direccion",
    texto: "¿Cuál es el lugar (nombre del salón o locación) y la dirección completa?",
  },
  {
    id: "mostrar_como_llegar",
    texto: "¿Querés que la invitación tenga un link de 'cómo llegar' a Google Maps? (sí/no)",
  },

  // Contenido de la invitación
  {
    id: "mensaje_portada",
    texto: "¿Tenés alguna frase o mensaje para la portada? Si no se te ocurre nada, escribí 'sugerime una' y te ayudamos con eso.",
  },
  {
    id: "dress_code",
    texto: "¿Qué vestimenta / dress code va a tener el evento?",
  },
  {
    id: "colores_evitar",
    texto: "¿Hay algo que pedís evitar (algún color en particular, por ejemplo)? Si no hay nada, escribí 'no'.",
  },
  {
    id: "datos_regalo",
    texto: "¿Incluimos datos para regalo (alias, CBU o Mercado Pago)? Si sí, pasámelos; si no querés esta sección, escribí 'no'.",
  },
  {
    id: "playlist_colaborativa",
    texto: "¿Querés una sección de playlist colaborativa, donde los invitados sugieren canciones? (sí/no)",
  },
  {
    id: "galeria_fotos",
    texto:
      "¿Querés galería de fotos? Contame si va con fotos que subís vos, o si preferís un álbum donde los invitados suban fotos el día del evento (esto último es un add-on aparte). Si no querés galería, escribí 'no'.",
  },

  // Marca / estética
  {
    id: "colores_estetica",
    texto: "¿Qué colores te gustaría usar en el diseño? Si tenés los hex, mandalos; si no, contame con tus palabras (ej. 'tonos pastel', 'dorado y blanco').",
  },
  {
    id: "fotos_referencia",
    tipo: "imagen",
    texto: "Mandame alguna foto que quieras usar en la invitación (portada o galería), como imagen acá mismo. Si todavía no tenés o las vas a mandar después, escribí 'después las mando'.",
  },
  {
    id: "invitacion_referencia",
    texto: "¿Tenés alguna invitación digital que hayas visto y te haya gustado, para tomarla de referencia? Pasame el link o describila; si no, escribí 'no'.",
  },

  // Logística de entrega
  {
    id: "contacto_entrega",
    texto: "¿Nombre y teléfono de contacto para coordinar la entrega y los ajustes?",
  },
  {
    id: "fecha_limite",
    texto: "¿Para cuándo necesitás que esté lista? (pensá la fecha del evento menos el tiempo que le vas a dar a los invitados para confirmar)",
  },
  {
    id: "dominio_propio",
    texto:
      "¿Querés un dominio propio (ej. www.misxv.com, tiene un costo aparte de aprox. USD 10-15 al año) o alcanza con un link tipo nombre-evento.vercel.app sin costo extra?",
  },
  {
    id: "plan_elegido",
    texto:
      "Último paso antes de confirmar — elegí el plan:\n1) Básico ($30.000, pago único): portada con cuenta regresiva, fecha, lugar, dress code y RSVP.\n2) Pro ($40.000, pago único): todo lo del Básico + regalo, playlist colaborativa y galería de fotos.\n+ Álbum de fotos compartido para el día del evento: +$12.000 (opcional, sumalo a cualquier plan).\n\nRespondé con el número del plan (y agregá 'con álbum' si lo querés sumar).",
  },
  {
    id: "confirmacion_pago_unico",
    texto:
      "Última pregunta: confirmame que entendés que esto es un pago único por la invitación (no es un servicio mensual) y contame cómo preferís pagar (transferencia, Mercado Pago, etc.).",
  },
];
